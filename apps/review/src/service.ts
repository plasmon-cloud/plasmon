import {
  exposeTool,
  publishAppStateChange,
  type JsonObject,
  type JsonValue,
  type MsgBusEndpointId,
  type MsgBusToolContext,
} from "neutron-tools/app";
import { ReviewEngine, ReviewEngineError } from "./engine.ts";
import { exportReviewMarkdown, parseReviewMarkdown, sourceImport } from "./markdown.ts";
import type { ReviewActor, ReviewAtomState, ReviewOperation } from "./model.ts";
import { NeutronFilesPort } from "./neutron_files_port.ts";
import { createIndexedDbReviewPersistence } from "./persistence.ts";
import { createIndexedDbReviewSubmissionStore, type ReviewSubmission } from "./submission.ts";

const STATE_TOPIC = "review.state";
const MAX_INTERCHANGE_TEXT = 200_000;
const MAX_RENDERED_SNAPSHOT_BYTES = 400_000;
const engine = new ReviewEngine(createIndexedDbReviewPersistence());
const files = new NeutronFilesPort();
const submissions = createIndexedDbReviewSubmissionStore();

const stringId = { type: "string", minLength: 1, maxLength: 240 } satisfies JsonObject;
const revisionId = stringId;
const commandId = { type: "string", minLength: 1, maxLength: 128 } satisfies JsonObject;
const desired = { type: ["string", "null"], enum: ["must", "high", "normal", "later", null] } satisfies JsonObject;
const effort = { type: ["string", "null"], enum: ["tiny", "small", "medium", "big", "really_big", null] } satisfies JsonObject;
const workState = { type: "string", enum: ["untriaged", "needs_design", "ready", "in_progress", "blocked", "needs_retest", "done", "deferred"] } satisfies JsonObject;
const idList = { type: "array", maxItems: 500, items: stringId } satisfies JsonObject;

const operationSchema: JsonObject = {
  oneOf: [
    objectSchema(["type", "title"], {
      type: { const: "review.create_item" }, itemId: stringId, title: { type: "string", minLength: 1, maxLength: 500 }, descriptionMarkdown: { type: "string", maxLength: 20_000 },
    }),
    objectSchema(["type", "itemId"], {
      type: { const: "review.update_item_text" }, itemId: stringId, title: { type: "string", minLength: 1, maxLength: 500 }, descriptionMarkdown: { type: ["string", "null"], maxLength: 20_000 },
    }),
    objectSchema(["type", "itemId", "result"], {
      type: { const: "review.set_result" }, itemId: stringId, result: { type: "string", enum: ["not_tested", "working", "not_working", "needs_polish"] }, note: { type: ["string", "null"], maxLength: 4_000 },
    }),
    objectSchema(["type", "itemId", "patch"], {
      type: { const: "review.set_coordination" }, itemId: stringId,
      patch: objectSchema([], {
        desired, effort, owner: { type: ["string", "null"], maxLength: 240 }, workState, blockedBy: idList, dependsOn: idList,
      }),
    }),
    objectSchema(["type", "itemId", "body"], {
      type: { const: "comment.add" }, itemId: stringId, commentId: stringId, body: { type: "string", minLength: 1, maxLength: 12_000 }, replyTo: stringId,
    }),
    objectSchema(["type", "revisionId"], { type: { const: "history.restore" }, revisionId }),
  ],
};

exposeTool(
  "review_catalog",
  {
    title: "List Review Atoms",
    description: "List logical Review Atoms owned by this Review installation. Atom identity is independent of source paths and revision history.",
    inputSchema: objectSchema([], {}),
    annotations: { "neutron:effects": ["read"] },
  },
  async () => asJson({ atoms: await engine.listAtoms() }),
);

exposeTool(
  "review_atom",
  {
    title: "Read Review Atom",
    description: "Read one logical Review Atom's current structured state.",
    inputSchema: objectSchema(["atomId"], { atomId: stringId }),
    annotations: { "neutron:effects": ["read"] },
  },
  async (args) => asJson(await engine.getAtom(requiredString(args.atomId, "atomId"))),
);

exposeTool(
  "review_submission",
  {
    title: "Read Review Submission",
    description: "Read the most recent deliberate submission marker for one Review Atom. Submission bookkeeping does not create a Review revision.",
    inputSchema: objectSchema(["atomId"], { atomId: stringId }),
    annotations: { "neutron:effects": ["read"] },
  },
  async (args) => asJson({ submission: await submissions.load(requiredString(args.atomId, "atomId")) }),
);

exposeTool(
  "review_command",
  {
    title: "Apply Review Command",
    description: "Apply one typed semantic Review transaction. Exactly one accepted command creates one new logical RevisionId; stale expectedRevision values fail.",
    inputSchema: objectSchema(["atomId", "expectedRevision", "commandId", "operation"], {
      atomId: stringId,
      expectedRevision: revisionId,
      commandId,
      operation: operationSchema,
    }),
    annotations: { "neutron:effects": ["write"] },
  },
  async (args, context) => {
    throwIfAborted(context.signal);
    const result = await engine.apply({
      atomId: requiredString(args.atomId, "atomId"),
      expectedRevision: requiredString(args.expectedRevision, "expectedRevision"),
      commandId: requiredString(args.commandId, "commandId"),
      actor: actorForCaller(context.caller),
      operation: requiredObject(args.operation, "operation") as unknown as ReviewOperation,
    });
    await announce(result.sequence);
    return asJson(result);
  },
);

exposeTool(
  "review_history",
  {
    title: "Read Review History",
    description: "List semantic logical revisions or reconstruct one historical logical revision.",
    inputSchema: objectSchema(["atomId"], { atomId: stringId, revisionId }),
    annotations: { "neutron:effects": ["read"] },
  },
  async (args) => {
    const atomId = requiredString(args.atomId, "atomId");
    const historical = optionalString(args.revisionId);
    if (historical) return asJson({ state: await engine.getRevision(atomId, historical) });
    return asJson({ revisions: await engine.history(atomId) });
  },
);

exposeTool(
  "review_create",
  {
    title: "Create Review Atom",
    description: "Create a new logical Review Atom in this installation. This is one bounded semantic creation transaction.",
    inputSchema: objectSchema(["commandId", "title"], { commandId, title: { type: "string", minLength: 1, maxLength: 240 } }),
    annotations: { "neutron:effects": ["write"] },
  },
  async (args, context) => {
    const result = await engine.createAtom({
      commandId: requiredString(args.commandId, "commandId"),
      title: requiredString(args.title, "title"),
      actor: actorForCaller(context.caller),
    });
    await announce(result.sequence);
    return asJson(result);
  },
);

// The guaranteed 0.1 AI -> Review boundary. It is intentionally independent of
// the optional Files application so a stock Review installation can always
// accept an AI-generated plan by paste/copy interchange.
exposeTool(
  "review_import_text",
  {
    title: "Import Review Plan Text",
    description: "Create a Review Atom from pasted Markdown/TODO acceptance-plan text without requiring the Files application.",
    inputSchema: objectSchema(["commandId", "markdown"], {
      commandId,
      markdown: { type: "string", minLength: 1, maxLength: MAX_INTERCHANGE_TEXT },
      title: { type: "string", minLength: 1, maxLength: 240 },
    }),
    annotations: { "neutron:effects": ["write"] },
  },
  async (args, context) => {
    throwIfAborted(context.signal);
    const markdown = requiredString(args.markdown, "markdown");
    const parsed = parseReviewMarkdown(markdown);
    if (parsed.items.length === 0) {
      throw new ReviewEngineError("IMPORT_EMPTY", "No acceptance checks were found. Use top-level Markdown bullets or checkboxes for the checks humans should perform.");
    }
    const result = await engine.createAtom({
      commandId: requiredString(args.commandId, "commandId"),
      title: optionalString(args.title) ?? parsed.title ?? "Imported Review",
      actor: actorForCaller(context.caller),
      items: parsed.items,
    });
    await announce(result.sequence);
    return asJson({ ...result, importedItems: parsed.items.length });
  },
);

// Submit is a deliberate publication boundary, but in the standalone app it
// prepares a stable text snapshot rather than pretending an AI has live access.
exposeTool(
  "review_submit",
  {
    title: "Submit Review Snapshot",
    description: "Mark the exact current Review revision as submitted and return its Markdown snapshot for explicit copy/handoff.",
    inputSchema: objectSchema(["atomId", "expectedRevision"], { atomId: stringId, expectedRevision: revisionId }),
    annotations: { "neutron:effects": ["read", "write"] },
  },
  async (args, context) => {
    throwIfAborted(context.signal);
    const atomId = requiredString(args.atomId, "atomId");
    const expectedRevision = requiredString(args.expectedRevision, "expectedRevision");
    const state = await currentAtExpectedRevision(atomId, expectedRevision);
    const markdown = boundedSnapshot(exportReviewMarkdown(state));
    const submission: ReviewSubmission = { atomId, revisionId: expectedRevision, submittedAt: Date.now() };
    await submissions.save(submission);
    return asJson({ submission, markdown });
  },
);

exposeTool(
  "review_render",
  {
    title: "Render Review Snapshot",
    description: "Render the current or one historical Review revision as Markdown without changing submission state.",
    inputSchema: objectSchema(["atomId"], { atomId: stringId, revisionId }),
    annotations: { "neutron:effects": ["read"] },
  },
  async (args) => {
    const atomId = requiredString(args.atomId, "atomId");
    const requestedRevision = optionalString(args.revisionId);
    const state = requestedRevision ? await engine.getRevision(atomId, requestedRevision) : await engine.getAtom(atomId);
    return asJson({ revisionId: state.meta.currentRevision, markdown: boundedSnapshot(exportReviewMarkdown(state)) });
  },
);

// Files remains a compatibility/portability path, not a prerequisite for the
// core acceptance workflow. Missing Files is translated into a useful Review
// error instead of leaking the message-bus endpoint name to the user.
exposeTool(
  "review_file",
  {
    title: "Import or Export Review Markdown through Files",
    description: "Optional Files-backed Markdown/TODO portability. Paste/copy interchange works without Files.",
    inputSchema: {
      oneOf: [
        objectSchema(["action", "commandId", "path"], {
          action: { const: "import" }, commandId, path: { type: "string", minLength: 1, maxLength: 512 }, title: { type: "string", minLength: 1, maxLength: 240 },
        }),
        objectSchema(["action", "atomId", "expectedRevision", "path"], {
          action: { const: "export" }, atomId: stringId, expectedRevision: revisionId, path: { type: "string", minLength: 1, maxLength: 512 }, ifMatch: { type: "string", minLength: 64, maxLength: 64 },
        }),
      ],
    },
    annotations: { "neutron:effects": ["read", "write"] },
  },
  async (args, context) => filesBoundary(async () => {
    throwIfAborted(context.signal);
    const action = requiredString(args.action, "action");
    const delegationToken = await requestAttachmentDelegation(context);
    if (action === "import") {
      const path = requiredString(args.path, "path");
      if (!/\.(?:md|markdown|txt|todo)$/iu.test(path)) throw new ReviewEngineError("IMPORT_FORMAT_UNSUPPORTED", "Review imports .md, .markdown, .txt, or .todo text files");
      const file = await files.readBinary(path, { ...(delegationToken ? { delegationToken } : {}) });
      const markdown = decodeUtf8(file.data);
      const parsed = parseReviewMarkdown(markdown);
      if (parsed.items.length === 0) throw new ReviewEngineError("IMPORT_EMPTY", "The selected file does not contain any top-level acceptance checks");
      const result = await engine.createAtom({
        commandId: requiredString(args.commandId, "commandId"),
        title: optionalString(args.title) ?? parsed.title ?? titleFromPath(path),
        actor: actorForCaller(context.caller),
        source: sourceImport(path, file.mediaType, Date.now(), file.etag),
        items: parsed.items,
      });
      await announce(result.sequence);
      return asJson({ ...result, importedItems: parsed.items.length, source: { path: file.path, mediaType: file.mediaType, etag: file.etag } });
    }
    if (action === "export") {
      const atomId = requiredString(args.atomId, "atomId");
      const expectedRevision = requiredString(args.expectedRevision, "expectedRevision");
      const path = requiredString(args.path, "path");
      const state = await currentAtExpectedRevision(atomId, expectedRevision);
      const markdown = boundedSnapshot(exportReviewMarkdown(state));
      const bytes = new TextEncoder().encode(markdown);
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const priorSubmission = await submissions.load(atomId);
      const requestedIfMatch = optionalString(args.ifMatch);
      const safeIfMatch = requestedIfMatch ?? (priorSubmission?.path === path ? priorSubmission.etag : undefined);
      const file = await files.writeBinary(
        path,
        "text/markdown",
        data,
        safeIfMatch ? { ifMatch: safeIfMatch } : { ifNoneMatch: "*" },
        { ...(delegationToken ? { delegationToken } : {}) },
      );
      const submission: ReviewSubmission = {
        atomId,
        revisionId: expectedRevision,
        submittedAt: Date.now(),
        path: file.path,
        etag: file.etag,
      };
      await submissions.save(submission);
      return asJson({ atomId, revisionId: expectedRevision, file, submission });
    }
    throw new ReviewEngineError("INVALID_ACTION", "review_file action must be import or export");
  }),
);

async function currentAtExpectedRevision(atomId: string, expectedRevision: string): Promise<ReviewAtomState> {
  const state = await engine.getAtom(atomId);
  if (state.meta.currentRevision !== expectedRevision) throw new ReviewEngineError("REVISION_CONFLICT", "Review changed before the snapshot was prepared. Refresh and submit again.");
  return state;
}

function boundedSnapshot(markdown: string): string {
  if (new TextEncoder().encode(markdown).byteLength > MAX_RENDERED_SNAPSHOT_BYTES) {
    throw new ReviewEngineError("EXPORT_TOO_LARGE", "This Review is too large for inline handoff. Reduce the review or use an available Files export.");
  }
  return markdown;
}

async function filesBoundary<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    const detail = errorMessage(cause);
    if (/app:files:background/iu.test(detail) || /unknown endpoint/iu.test(detail)) {
      throw new ReviewEngineError("FILES_UNAVAILABLE", "Files is not available in this Neutron. Paste the test plan directly into Review, or use Submit and Copy for AI instead.");
    }
    throw cause;
  }
}

function actorForCaller(caller?: { appId?: string; role?: string }): ReviewActor {
  if (caller?.appId === "review" && caller.role === "tile") return { key: "human:local", type: "human", displayName: "Local reviewer" };
  if (caller?.appId) return { key: `app:${caller.appId}:${caller.role ?? "tool"}`, type: "ai", displayName: caller.appId };
  return { key: "system:local", type: "system", displayName: "Local system" };
}

async function announce(sequence: number): Promise<void> {
  await publishAppStateChange(STATE_TOPIC, sequence).catch(() => {});
}

function objectSchema(required: string[], properties: Record<string, JsonValue>): JsonObject {
  return { type: "object", required, properties, additionalProperties: false };
}

function requiredString(value: JsonValue | undefined, name: string): string {
  if (typeof value !== "string" || !value) throw new ReviewEngineError("INVALID_INPUT", `${name} must be a non-empty string`);
  return value;
}

function optionalString(value: JsonValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ReviewEngineError("INVALID_INPUT", "Expected a string");
  return value || undefined;
}

function requiredObject(value: JsonValue | undefined, name: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReviewEngineError("INVALID_INPUT", `${name} must be an object`);
  return value as JsonObject;
}

function asJson(value: unknown): JsonValue { return value as JsonValue; }

function decodeUtf8(data: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(data); }
  catch { throw new ReviewEngineError("IMPORT_ENCODING_INVALID", "Review source must be valid UTF-8 text"); }
}

function titleFromPath(path: string): string {
  const name = path.split("/").filter(Boolean).pop() ?? "Imported Review";
  return name.replace(/\.(?:md|markdown|txt|todo)$/iu, "") || "Imported Review";
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) return String((value as { message: unknown }).message);
  return String(value);
}

export async function requestAttachmentDelegation(context: MsgBusToolContext): Promise<string | undefined> {
  throwIfAborted(context.signal);
  const response = await context.kernel.callTool({
    target: "kernel" as MsgBusEndpointId,
    name: "attachments.delegate",
    arguments: {},
  }, 5);
  if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error("Kernel returned an invalid attachment delegation response");
  const token = response.token;
  const expiresAt = response.expiresAt;
  if (token === null && expiresAt === null) return undefined;
  if (typeof token !== "string" || !token || typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("Kernel returned an invalid or expired attachment delegation token");
  }
  return token;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new ReviewEngineError("REQUEST_CANCELLED", "Review operation was cancelled");
}
