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
import type { ReviewActor, ReviewOperation } from "./model.ts";
import { NeutronFilesPort } from "./neutron_files_port.ts";
import { createIndexedDbReviewPersistence } from "./persistence.ts";

const STATE_TOPIC = "review:state";
const engine = new ReviewEngine(createIndexedDbReviewPersistence());
const files = new NeutronFilesPort();

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

exposeTool(
  "review_file",
  {
    title: "Import or Export Review Markdown",
    description: "Import Markdown/TODO through normal Neutron Files into a new logical Review Atom, or export one current Atom as readable Markdown. Source path is provenance, never Atom identity.",
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
  async (args, context) => {
    throwIfAborted(context.signal);
    const delegationToken = await requestAttachmentDelegation(context);
    const action = requiredString(args.action, "action");
    if (action === "import") {
      const path = requiredString(args.path, "path");
      if (!/\.(?:md|markdown|txt|todo)$/iu.test(path)) throw new ReviewEngineError("IMPORT_FORMAT_UNSUPPORTED", "Review imports .md, .markdown, .txt, or .todo text files");
      const file = await files.readBinary(path, { ...(delegationToken ? { delegationToken } : {}) });
      const markdown = decodeUtf8(file.data);
      const parsed = parseReviewMarkdown(markdown);
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
      const state = await engine.getAtom(atomId);
      if (state.meta.currentRevision !== expectedRevision) throw new ReviewEngineError("REVISION_CONFLICT", "Review Atom changed before export");
      const markdown = exportReviewMarkdown(state);
      const bytes = new TextEncoder().encode(markdown);
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const ifMatch = optionalString(args.ifMatch);
      const file = await files.writeBinary(
        requiredString(args.path, "path"),
        "text/markdown",
        data,
        ifMatch ? { ifMatch } : { ifNoneMatch: "*" },
        { ...(delegationToken ? { delegationToken } : {}) },
      );
      return asJson({ atomId, revisionId: expectedRevision, file });
    }
    throw new ReviewEngineError("INVALID_ACTION", "review_file action must be import or export");
  },
);

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
