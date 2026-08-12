import {
  cloneState,
  createEmptyItem,
  type ApplyReviewCommandRequest,
  type ApplyReviewCommandResult,
  type AtomId,
  type CommandReceipt,
  type CreateReviewAtomInput,
  type ReviewActor,
  type ReviewAtomMeta,
  type ReviewAtomState,
  type ReviewCheckpoint,
  type ReviewComment,
  type ReviewItem,
  type ReviewOperation,
  type ReviewRevision,
  type RevisionId,
} from "./model.ts";
import type { ReviewPersistence } from "./persistence.ts";

const CHECKPOINT_INTERVAL = 20;
const TEST_RESULTS = new Set(["not_tested", "working", "not_working", "needs_polish"]);
const DESIRED_VALUES = new Set<unknown>(["must", "high", "normal", "later", null]);
const EFFORT_VALUES = new Set<unknown>(["tiny", "small", "medium", "big", "really_big", null]);
const WORK_STATES = new Set(["untriaged", "needs_design", "ready", "in_progress", "blocked", "needs_retest", "done", "deferred"]);
const ACTOR_TYPES = new Set(["human", "ai", "system"]);

export class ReviewEngineError extends Error {
  constructor(readonly code: string, message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ReviewEngineError";
  }
}

export interface ReviewEngineOptions {
  now?: () => number;
  id?: (kind: "atom" | "item" | "comment" | "revision") => string;
}

export class ReviewEngine {
  private readonly now: () => number;
  private readonly id: NonNullable<ReviewEngineOptions["id"]>;
  private readonly atomWrites = new Map<AtomId, Promise<void>>();

  constructor(private readonly persistence: ReviewPersistence, options: ReviewEngineOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.id = options.id ?? defaultId;
  }

  async listAtoms(): Promise<ReviewAtomMeta[]> {
    return this.persistence.listMetas();
  }

  async getAtom(atomId: AtomId): Promise<ReviewAtomState> {
    const state = await this.persistence.loadCurrent(atomId);
    if (!state) throw new ReviewEngineError("ATOM_NOT_FOUND", `Review Atom ${atomId} was not found`);
    return sortState(state);
  }

  async createAtom(input: CreateReviewAtomInput): Promise<ApplyReviewCommandResult> {
    validateCommandId(input.commandId);
    const prior = await this.persistence.findReceipt(input.commandId);
    if (prior) return receiptResult(prior, true);
    const title = cleanText(input.title, "title", 240);
    const now = this.now();
    const atomId = this.id("atom");
    const revisionId = this.id("revision");
    const itemIds = new Set<string>();
    const items = (input.items ?? []).map((seed, order) => {
      const itemId = seed.itemId ?? this.id("item");
      if (itemIds.has(itemId)) throw new ReviewEngineError("DUPLICATE_ITEM_ID", `Duplicate ReviewItemId ${itemId}`);
      itemIds.add(itemId);
      return createEmptyItem(itemId, cleanText(seed.title, "item title", 500), optionalCleanText(seed.descriptionMarkdown, 20_000), order);
    });
    const meta: ReviewAtomMeta = {
      atomId,
      atomType: "plasmon.review/v1",
      title,
      currentRevision: revisionId,
      currentSequence: 1,
      createdAt: now,
      updatedAt: now,
      ...(input.source ? { source: cloneState(input.source) } : {}),
    };
    const state: ReviewAtomState = { meta, items, comments: [] };
    const revision: ReviewRevision = {
      atomId,
      revisionId,
      sequence: 1,
      parentRevisionId: null,
      actor: normalizeActor(input.actor),
      occurredAt: now,
      operation: {
        type: "atom.create",
        itemCount: items.length,
        ...(input.source?.path ? { sourcePath: input.source.path } : {}),
      },
      summary: input.source?.path
        ? `Imported ${items.length} review item${items.length === 1 ? "" : "s"} from ${input.source.path}`
        : `Created review with ${items.length} item${items.length === 1 ? "" : "s"}`,
    };
    const receipt = makeReceipt(input.commandId, meta);
    await this.persistence.commit({
      meta,
      revision,
      receipt,
      replaceCurrent: state,
      checkpoint: checkpoint(state, revision),
    });
    return receiptResult(receipt, false);
  }

  async apply(request: ApplyReviewCommandRequest): Promise<ApplyReviewCommandResult> {
    validateCommandId(request.commandId);
    return this.withAtomWrite(request.atomId, async () => {
      const prior = await this.persistence.findReceipt(request.commandId);
      if (prior) {
        if (prior.atomId !== request.atomId) throw new ReviewEngineError("COMMAND_ID_REUSED", "CommandId was already used for another Atom");
        return receiptResult(prior, true);
      }
      const current = await this.getAtom(request.atomId);
      if (current.meta.currentRevision !== request.expectedRevision) {
        throw new ReviewEngineError("REVISION_CONFLICT", "Review Atom changed before this command was applied", {
          expectedRevision: request.expectedRevision,
          currentRevision: current.meta.currentRevision,
        });
      }
      const revisionId = this.id("revision");
      const sequence = current.meta.currentSequence + 1;
      const now = this.now();
      const actor = normalizeActor(request.actor);
      const operation = normalizeOperation(request.operation, this.id);
      const change = await this.applyOperation(current, operation, actor, revisionId, now);
      const meta: ReviewAtomMeta = {
        ...current.meta,
        currentRevision: revisionId,
        currentSequence: sequence,
        updatedAt: now,
      };
      const state: ReviewAtomState = { meta, items: change.state.items, comments: change.state.comments };
      const revision: ReviewRevision = {
        atomId: request.atomId,
        revisionId,
        sequence,
        parentRevisionId: current.meta.currentRevision,
        actor,
        occurredAt: now,
        operation,
        summary: change.summary,
      };
      const receipt = makeReceipt(request.commandId, meta);
      const requiresCheckpoint = operation.type === "history.restore" || sequence % CHECKPOINT_INTERVAL === 0;
      await this.persistence.commit({
        meta,
        revision,
        receipt,
        ...(change.replaceCurrent ? { replaceCurrent: state } : {}),
        ...(!change.replaceCurrent && change.putItems.length ? { putItems: change.putItems } : {}),
        ...(!change.replaceCurrent && change.putComments.length ? { putComments: change.putComments } : {}),
        ...(requiresCheckpoint ? { checkpoint: checkpoint(state, revision) } : {}),
      });
      return receiptResult(receipt, false);
    });
  }

  async history(atomId: AtomId): Promise<ReviewRevision[]> {
    await this.getAtom(atomId);
    return this.persistence.loadRevisions(atomId);
  }

  async getRevision(atomId: AtomId, revisionId: RevisionId): Promise<ReviewAtomState> {
    const revisions = await this.persistence.loadRevisions(atomId);
    const target = revisions.find((entry) => entry.revisionId === revisionId);
    if (!target) throw new ReviewEngineError("REVISION_NOT_FOUND", `Revision ${revisionId} was not found`);
    const checkpoints: ReviewCheckpoint[] = [];
    for (const entry of revisions) {
      if (entry.sequence > target.sequence) break;
      const value = await this.persistence.loadCheckpoint(atomId, entry.revisionId);
      if (value) checkpoints.push(value);
    }
    const base = checkpoints.sort((a, b) => b.sequence - a.sequence)[0];
    if (!base) throw new ReviewEngineError("HISTORY_INCOMPLETE", "No checkpoint can reconstruct this Review revision");
    let state = cloneState(base.state);
    for (const entry of revisions) {
      if (entry.sequence <= base.sequence || entry.sequence > target.sequence) continue;
      if (entry.operation.type === "atom.create") continue;
      if (entry.operation.type === "history.restore") {
        throw new ReviewEngineError("HISTORY_INCOMPLETE", "Restore revision is missing its required checkpoint");
      }
      state = replayOperation(state, entry.operation, entry.actor, entry.revisionId, entry.occurredAt);
      state.meta = {
        ...state.meta,
        currentRevision: entry.revisionId,
        currentSequence: entry.sequence,
        updatedAt: entry.occurredAt,
      };
    }
    state.meta = {
      ...state.meta,
      currentRevision: target.revisionId,
      currentSequence: target.sequence,
      updatedAt: target.occurredAt,
    };
    return sortState(state);
  }

  private async withAtomWrite<T>(atomId: AtomId, operation: () => Promise<T>): Promise<T> {
    const previous = this.atomWrites.get(atomId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.atomWrites.set(atomId, tail);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.atomWrites.get(atomId) === tail) this.atomWrites.delete(atomId);
    }
  }

  private async applyOperation(
    current: ReviewAtomState,
    operation: ReviewOperation,
    actor: ReviewActor,
    revisionId: RevisionId,
    now: number,
  ): Promise<{ state: ReviewAtomState; putItems: ReviewItem[]; putComments: ReviewComment[]; replaceCurrent: boolean; summary: string }> {
    if (operation.type === "history.restore") {
      const historical = await this.getRevision(current.meta.atomId, operation.revisionId);
      return {
        state: {
          meta: { ...historical.meta, atomId: current.meta.atomId, createdAt: current.meta.createdAt, source: current.meta.source },
          items: historical.items,
          comments: historical.comments,
        },
        putItems: [],
        putComments: [],
        replaceCurrent: true,
        summary: `Restored whole Review Atom from revision ${operation.revisionId}`,
      };
    }
    const next = replayOperation(current, operation, actor, revisionId, now, this.id);
    const changedItemIds = changedItemsFor(operation, next);
    const putItems = next.items.filter((item) => changedItemIds.has(item.itemId));
    const putComments = operation.type === "comment.add"
      ? next.comments.filter((comment) => comment.revisionId === revisionId)
      : [];
    return {
      state: next,
      putItems,
      putComments,
      replaceCurrent: false,
      summary: summarize(operation, actor, next),
    };
  }
}

function replayOperation(
  current: ReviewAtomState,
  operation: Exclude<ReviewOperation, { type: "history.restore" }>,
  actor: ReviewActor,
  revisionId: RevisionId,
  now: number,
  id: (kind: "atom" | "item" | "comment" | "revision") => string = defaultId,
): ReviewAtomState {
  const state = cloneState(current);
  if (operation.type === "review.create_item") {
    const itemId = operation.itemId ?? id("item");
    if (state.items.some((item) => item.itemId === itemId)) throw new ReviewEngineError("DUPLICATE_ITEM_ID", `ReviewItemId ${itemId} already exists`);
    const order = state.items.reduce((highest, item) => Math.max(highest, item.order), -1) + 1;
    state.items.push(createEmptyItem(itemId, cleanText(operation.title, "item title", 500), optionalCleanText(operation.descriptionMarkdown, 20_000), order));
    return state;
  }
  const item = state.items.find((candidate) => candidate.itemId === operation.itemId);
  if (!item) throw new ReviewEngineError("ITEM_NOT_FOUND", `Review item ${operation.itemId} was not found`);
  if (operation.type === "review.update_item_text") {
    if (operation.title !== undefined) item.title = cleanText(operation.title, "item title", 500);
    if (operation.descriptionMarkdown === null) delete item.descriptionMarkdown;
    else if (operation.descriptionMarkdown !== undefined) item.descriptionMarkdown = optionalCleanText(operation.descriptionMarkdown, 20_000);
    return state;
  }
  if (operation.type === "review.set_result") {
    const note = operation.note === null ? undefined : optionalCleanText(operation.note, 4_000);
    item.results[actor.key] = {
      actor: actor.key,
      result: operation.result,
      ...(note ? { note } : {}),
      updatedAt: now,
      revisionId,
    };
    return state;
  }
  if (operation.type === "review.set_coordination") {
    item.coordination = {
      ...item.coordination,
      ...cloneState(operation.patch),
      blockedBy: operation.patch.blockedBy ? uniqueIds(operation.patch.blockedBy) : item.coordination.blockedBy,
      dependsOn: operation.patch.dependsOn ? uniqueIds(operation.patch.dependsOn) : item.coordination.dependsOn,
    };
    return state;
  }
  const commentId = operation.commentId ?? id("comment");
  if (state.comments.some((comment) => comment.commentId === commentId)) throw new ReviewEngineError("DUPLICATE_COMMENT_ID", `CommentId ${commentId} already exists`);
  if (operation.replyTo && !state.comments.some((comment) => comment.commentId === operation.replyTo && comment.itemId === item.itemId)) {
    throw new ReviewEngineError("COMMENT_PARENT_NOT_FOUND", `Reply target ${operation.replyTo} was not found on this item`);
  }
  const comment: ReviewComment = {
    commentId,
    itemId: item.itemId,
    actor: actor.key,
    ...(actor.type ? { actorType: actor.type } : {}),
    ...(actor.displayName ? { displayName: actor.displayName } : {}),
    body: cleanText(operation.body, "comment", 12_000),
    createdAt: now,
    revisionId,
    ...(operation.replyTo ? { replyTo: operation.replyTo } : {}),
  };
  state.comments.push(comment);
  item.commentIds.push(commentId);
  return state;
}

function normalizeOperation(
  operation: ReviewOperation,
  id: (kind: "atom" | "item" | "comment" | "revision") => string,
): ReviewOperation {
  if (!operation || typeof operation !== "object") throw new ReviewEngineError("INVALID_OPERATION", "Review operation is required");
  const type = (operation as { type?: unknown }).type;
  if (typeof type !== "string") throw new ReviewEngineError("INVALID_OPERATION", "Review operation type is required");
  if (type === "review.create_item") {
    const value = operation as Extract<ReviewOperation, { type: "review.create_item" }>;
    const normalized = cloneState(value);
    cleanText(normalized.title, "item title", 500);
    if (normalized.descriptionMarkdown !== undefined) optionalCleanText(normalized.descriptionMarkdown, 20_000);
    if (!normalized.itemId) normalized.itemId = id("item");
    else cleanText(normalized.itemId, "itemId", 240);
    return normalized;
  }
  if (type === "review.update_item_text") {
    const value = operation as Extract<ReviewOperation, { type: "review.update_item_text" }>;
    cleanText(value.itemId, "itemId", 240);
    if (value.title !== undefined) cleanText(value.title, "item title", 500);
    if (value.descriptionMarkdown !== undefined && value.descriptionMarkdown !== null) optionalCleanText(value.descriptionMarkdown, 20_000);
    if (value.title === undefined && value.descriptionMarkdown === undefined) throw new ReviewEngineError("INVALID_OPERATION", "Item text update cannot be empty");
    return cloneState(value);
  }
  if (type === "review.set_result") {
    const value = operation as Extract<ReviewOperation, { type: "review.set_result" }>;
    cleanText(value.itemId, "itemId", 240);
    if (!TEST_RESULTS.has(value.result)) throw new ReviewEngineError("INVALID_OPERATION", `Unknown test result ${String(value.result)}`);
    if (value.note !== undefined && value.note !== null) optionalCleanText(value.note, 4_000);
    return cloneState(value);
  }
  if (type === "review.set_coordination") {
    const value = operation as Extract<ReviewOperation, { type: "review.set_coordination" }>;
    cleanText(value.itemId, "itemId", 240);
    if (!value.patch || typeof value.patch !== "object" || Array.isArray(value.patch)) throw new ReviewEngineError("INVALID_OPERATION", "Coordination patch must be an object");
    const allowed = new Set(["desired", "effort", "owner", "workState", "blockedBy", "dependsOn"]);
    for (const key of Object.keys(value.patch)) if (!allowed.has(key)) throw new ReviewEngineError("INVALID_OPERATION", `Unknown coordination field ${key}`);
    if (Object.keys(value.patch).length === 0) throw new ReviewEngineError("INVALID_OPERATION", "Coordination patch cannot be empty");
    if (value.patch.desired !== undefined && !DESIRED_VALUES.has(value.patch.desired)) throw new ReviewEngineError("INVALID_OPERATION", `Unknown Desired value ${String(value.patch.desired)}`);
    if (value.patch.effort !== undefined && !EFFORT_VALUES.has(value.patch.effort)) throw new ReviewEngineError("INVALID_OPERATION", `Unknown Effort value ${String(value.patch.effort)}`);
    if (value.patch.workState !== undefined && !WORK_STATES.has(value.patch.workState)) throw new ReviewEngineError("INVALID_OPERATION", `Unknown WorkState ${String(value.patch.workState)}`);
    if (value.patch.owner !== undefined && value.patch.owner !== null) cleanText(value.patch.owner, "owner", 240);
    if (value.patch.blockedBy !== undefined) uniqueIds(value.patch.blockedBy);
    if (value.patch.dependsOn !== undefined) uniqueIds(value.patch.dependsOn);
    return cloneState(value);
  }
  if (type === "comment.add") {
    const value = operation as Extract<ReviewOperation, { type: "comment.add" }>;
    cleanText(value.itemId, "itemId", 240);
    cleanText(value.body, "comment", 12_000);
    if (value.replyTo) cleanText(value.replyTo, "replyTo", 240);
    const normalized = cloneState(value);
    if (!normalized.commentId) normalized.commentId = id("comment");
    else cleanText(normalized.commentId, "commentId", 240);
    return normalized;
  }
  if (type === "history.restore") {
    const value = operation as Extract<ReviewOperation, { type: "history.restore" }>;
    cleanText(value.revisionId, "revisionId", 240);
    return cloneState(value);
  }
  throw new ReviewEngineError("INVALID_OPERATION", `Unknown Review operation ${type}`);
}

function changedItemsFor(operation: Exclude<ReviewOperation, { type: "history.restore" }>, state: ReviewAtomState): Set<string> {
  if (operation.type === "review.create_item") {
    const item = state.items[state.items.length - 1];
    return new Set(item ? [item.itemId] : []);
  }
  return new Set([operation.itemId]);
}

function summarize(operation: Exclude<ReviewOperation, { type: "history.restore" }>, actor: ReviewActor, state: ReviewAtomState): string {
  const who = actor.displayName ?? actor.key;
  if (operation.type === "review.create_item") return `${who} added “${operation.title}”`;
  const item = state.items.find((candidate) => candidate.itemId === operation.itemId);
  const label = item?.title ?? operation.itemId;
  if (operation.type === "review.update_item_text") return `${who} updated “${label}”`;
  if (operation.type === "review.set_result") return `${who} marked “${label}” ${operation.result.replaceAll("_", " ")}`;
  if (operation.type === "review.set_coordination") return `${who} updated coordination for “${label}”`;
  return `${who} commented on “${label}”`;
}

function checkpoint(state: ReviewAtomState, revision: ReviewRevision): ReviewCheckpoint {
  return {
    atomId: state.meta.atomId,
    revisionId: revision.revisionId,
    sequence: revision.sequence,
    state: cloneState(state),
  };
}

function makeReceipt(commandId: string, meta: ReviewAtomMeta): CommandReceipt {
  return { commandId, atomId: meta.atomId, revisionId: meta.currentRevision, sequence: meta.currentSequence };
}

function receiptResult(receipt: CommandReceipt, replayed: boolean): ApplyReviewCommandResult {
  return { atomId: receipt.atomId, revisionId: receipt.revisionId, sequence: receipt.sequence, replayed };
}

function normalizeActor(actor: ReviewActor): ReviewActor {
  const key = cleanText(actor?.key, "actor key", 240);
  if (actor.type !== undefined && !ACTOR_TYPES.has(actor.type)) throw new ReviewEngineError("INVALID_ACTOR", `Unknown actor type ${String(actor.type)}`);
  return {
    key,
    ...(actor.type ? { type: actor.type } : {}),
    ...(actor.displayName ? { displayName: cleanText(actor.displayName, "actor display name", 240) } : {}),
  };
}

function uniqueIds(values: string[]): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) throw new ReviewEngineError("INVALID_OPERATION", "Dependency references must be non-empty strings");
  return [...new Set(values.map((value) => value.trim()))];
}

function cleanText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new ReviewEngineError("INVALID_INPUT", `${name} must be a string`);
  const clean = value.trim();
  if (!clean) throw new ReviewEngineError("INVALID_INPUT", `${name} cannot be empty`);
  if (clean.length > max) throw new ReviewEngineError("INVALID_INPUT", `${name} exceeds ${max} characters`);
  return clean;
}

function optionalCleanText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.trim();
  if (!clean) return undefined;
  if (clean.length > max) throw new ReviewEngineError("INVALID_INPUT", `Text exceeds ${max} characters`);
  return clean;
}

function validateCommandId(commandId: string): void {
  if (typeof commandId !== "string" || commandId.length < 1 || commandId.length > 128) {
    throw new ReviewEngineError("INVALID_COMMAND_ID", "commandId must be 1-128 characters");
  }
}

function sortState(state: ReviewAtomState): ReviewAtomState {
  const next = cloneState(state);
  next.items.sort((a, b) => a.order - b.order || a.itemId.localeCompare(b.itemId));
  next.comments.sort((a, b) => a.createdAt - b.createdAt || a.commentId.localeCompare(b.commentId));
  return next;
}

function defaultId(kind: "atom" | "item" | "comment" | "revision"): string {
  return `${kind}_${globalThis.crypto.randomUUID()}`;
}
