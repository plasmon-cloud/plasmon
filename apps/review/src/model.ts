export type AtomId = string;
export type ReviewItemId = string;
export type CommentId = string;
export type RevisionId = string;
export type ActorKey = string;

export type TestResult = "not_tested" | "working" | "not_working" | "needs_polish";
export type Desired = "must" | "high" | "normal" | "later" | null;
export type Effort = "tiny" | "small" | "medium" | "big" | "really_big" | null;
export type WorkState =
  | "untriaged"
  | "needs_design"
  | "ready"
  | "in_progress"
  | "blocked"
  | "needs_retest"
  | "done"
  | "deferred";

export type ActorType = "human" | "ai" | "system";

export interface ReviewActor {
  key: ActorKey;
  type?: ActorType;
  displayName?: string;
}

export interface SourceImport {
  path: string;
  mediaType: string;
  etag?: string;
  importedAt: number;
}

export interface ParticipantResult {
  actor: ActorKey;
  result: TestResult;
  note?: string;
  updatedAt: number;
  revisionId: RevisionId;
}

export interface ReviewCoordination {
  desired: Desired;
  effort: Effort;
  owner: string | null;
  workState: WorkState;
  blockedBy: ReviewItemId[];
  dependsOn: ReviewItemId[];
}

export interface ReviewItem {
  itemId: ReviewItemId;
  order: number;
  title: string;
  descriptionMarkdown?: string;
  results: Record<ActorKey, ParticipantResult>;
  coordination: ReviewCoordination;
  commentIds: CommentId[];
}

export interface ReviewComment {
  commentId: CommentId;
  itemId: ReviewItemId;
  actor: ActorKey;
  actorType?: ActorType;
  displayName?: string;
  body: string;
  createdAt: number;
  revisionId: RevisionId;
  replyTo?: CommentId;
}

export interface ReviewAtomMeta {
  atomId: AtomId;
  atomType: "plasmon.review/v1";
  title: string;
  currentRevision: RevisionId;
  currentSequence: number;
  createdAt: number;
  updatedAt: number;
  source?: SourceImport;
}

export interface ReviewAtomState {
  meta: ReviewAtomMeta;
  items: ReviewItem[];
  comments: ReviewComment[];
}

export type SetCoordinationPatch = Partial<Pick<ReviewCoordination,
  "desired" | "effort" | "owner" | "workState" | "blockedBy" | "dependsOn"
>>;

export type ReviewOperation =
  | { type: "review.create_item"; itemId?: ReviewItemId; title: string; descriptionMarkdown?: string }
  | { type: "review.update_item_text"; itemId: ReviewItemId; title?: string; descriptionMarkdown?: string | null }
  | { type: "review.set_result"; itemId: ReviewItemId; result: TestResult; note?: string | null }
  | { type: "review.set_coordination"; itemId: ReviewItemId; patch: SetCoordinationPatch }
  | { type: "comment.add"; itemId: ReviewItemId; commentId?: CommentId; body: string; replyTo?: CommentId }
  | { type: "history.restore"; revisionId: RevisionId };

export interface ReviewRevision {
  atomId: AtomId;
  revisionId: RevisionId;
  sequence: number;
  parentRevisionId: RevisionId | null;
  actor: ReviewActor;
  occurredAt: number;
  operation: ReviewOperation | { type: "atom.create"; itemCount: number; sourcePath?: string };
  summary: string;
}

export interface ReviewCheckpoint {
  atomId: AtomId;
  revisionId: RevisionId;
  sequence: number;
  state: ReviewAtomState;
}

export interface CommandReceipt {
  commandId: string;
  atomId: AtomId;
  revisionId: RevisionId;
  sequence: number;
}

export interface ApplyReviewCommandRequest {
  atomId: AtomId;
  expectedRevision: RevisionId;
  commandId: string;
  actor: ReviewActor;
  operation: ReviewOperation;
}

export interface ApplyReviewCommandResult {
  atomId: AtomId;
  revisionId: RevisionId;
  sequence: number;
  replayed: boolean;
}

export interface CreateReviewAtomInput {
  commandId: string;
  title: string;
  actor: ReviewActor;
  source?: SourceImport;
  items?: Array<{ itemId?: ReviewItemId; title: string; descriptionMarkdown?: string }>;
}

export const EMPTY_COORDINATION: Readonly<ReviewCoordination> = Object.freeze({
  desired: null,
  effort: null,
  owner: null,
  workState: "untriaged",
  blockedBy: [],
  dependsOn: [],
});

export function createEmptyItem(itemId: ReviewItemId, title: string, descriptionMarkdown?: string, order = 0): ReviewItem {
  return {
    itemId,
    order,
    title,
    ...(descriptionMarkdown ? { descriptionMarkdown } : {}),
    results: {},
    coordination: {
      desired: null,
      effort: null,
      owner: null,
      workState: "untriaged",
      blockedBy: [],
      dependsOn: [],
    },
    commentIds: [],
  };
}

export function cloneState<T>(value: T): T {
  return structuredClone(value);
}
