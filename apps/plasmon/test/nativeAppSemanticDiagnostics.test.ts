import { describe, expect, test } from "bun:test";
import type { ProcessCloseRequest } from "../src/os/contracts/index.ts";
import {
  DiagnosticEvent,
  DiagnosticSubsystem,
} from "../src/os/diagnostics/index.ts";
import type { FilesystemTrashService } from "../src/os/fs/index.ts";
import { applyMarkdownFormatter } from "../src/native-apps/markdown/markdownFormatter.ts";
import { RecycleBinModel } from "../src/native-apps/recycle-bin/model.ts";
import {
  reportPhotosDecodeFailure,
  reportVideoPlaybackError,
} from "../src/native-apps/semanticDiagnostics.ts";
import {
  DocumentCloseModel,
  type DocumentCloseSession,
} from "../src/native-apps/text/documentClose.ts";
import { isExpectedVideoPlayRejection } from "../src/native-apps/video/VideoPlayer.tsx";
import { observeDiagnostics } from "./diagnosticObserver.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

function closeRequest(onComplete = () => {}, onCancel = () => {}): ProcessCloseRequest {
  return { complete: onComplete, cancel: onCancel } as ProcessCloseRequest;
}

describe("native app semantic diagnostics", () => {
  test("records an unexpected swallowed deferred-close save throw but not a normal failed save", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observation = observeDiagnostics(env.diagnostics);
    try {
      await env.ready;
      const throwingSession: DocumentCloseSession = {
        snapshot: () => ({ dirty: true, status: "ready" }),
        save: async () => { throw new Error("/Users/alice/private.md?token=secret"); },
        suspendAutosave: () => {},
        resumeAutosave: () => {},
        discardOnClose: () => {},
      };
      const throwing = new DocumentCloseModel(throwingSession);
      expect(throwing.requestClose(closeRequest())).toBe("defer");
      expect(await throwing.saveAndClose()).toBe(false);
      expect(throwing.snapshot().pending).toBe(true);

      const failures = await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.DocumentCloseSaveUnexpectedFailure,
        level: "error",
      });
      expect(failures).toHaveLength(1);
      const serialized = JSON.stringify(failures[0]);
      expect(serialized).not.toContain("private.md");
      expect(serialized).not.toContain("token=secret");

      const handledSession: DocumentCloseSession = {
        ...throwingSession,
        save: async () => false,
      };
      const handled = new DocumentCloseModel(handledSession);
      expect(handled.requestClose(closeRequest())).toBe("defer");
      expect(await handled.saveAndClose()).toBe(false);
      expect(await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.DocumentCloseSaveUnexpectedFailure,
      })).toHaveLength(1);
    } finally {
      observation.dispose();
      env.dispose();
    }
  });

  test("reports formatter recovery without leaking source/error details and keeps formatter absence quiet", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observation = observeDiagnostics(env.diagnostics);
    try {
      await env.ready;
      const source = "# confidential document token-omega";
      const failed = applyMarkdownFormatter(source, () => {
        throw new Error("C:\\Private\\notes.md?credential=hunter2");
      });
      expect(failed.text).toBe(source);
      expect(failed.error).toContain("Markdown formatting failed");

      const records = await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.MarkdownFormatFailed,
        level: "error",
      });
      expect(records).toHaveLength(1);
      const serialized = JSON.stringify(records[0]);
      expect(serialized).not.toContain("confidential document");
      expect(serialized).not.toContain("Private");
      expect(serialized).not.toContain("hunter2");

      expect(applyMarkdownFormatter(source, null).error).toBe("No Markdown formatter is available.");
      expect(await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.MarkdownFormatFailed,
      })).toHaveLength(1);
    } finally {
      observation.dispose();
      env.dispose();
    }
  });

  test("reports only aggregate Recycle Bin partial semantics after prior success", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observation = observeDiagnostics(env.diagnostics);
    try {
      await env.ready;
      let restoreCalls = 0;
      const trash = {
        list: async () => [],
        restore: async (itemId: string) => {
          restoreCalls += 1;
          if (restoreCalls === 2) throw new Error(`/Trash/${itemId}/original-secret.txt`);
          return {
            node: { id: "restored-node", name: "restored.txt" },
            usedFallback: false,
            renamed: false,
          };
        },
        permanentlyDelete: async () => {},
        empty: async () => 0,
      } as unknown as FilesystemTrashService;

      await expect(new RecycleBinModel(trash).restore([
        "trash-secret-1",
        "trash-secret-2",
      ])).rejects.toThrow();

      const partial = await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.RecycleBinBatchPartialFailure,
        level: "error",
      });
      expect(partial).toHaveLength(1);
      expect(partial[0]?.context).toMatchObject({
        operation: "restore",
        requestedCount: 2,
        completedCount: 1,
      });
      const serialized = JSON.stringify(partial[0]);
      expect(serialized).not.toContain("trash-secret");
      expect(serialized).not.toContain("original-secret");

      const firstFailureTrash = {
        ...trash,
        restore: async () => { throw new Error("lower-owned failure"); },
      } as unknown as FilesystemTrashService;
      await expect(new RecycleBinModel(firstFailureTrash).restore(["one"])).rejects.toThrow();
      expect(await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.RecycleBinBatchPartialFailure,
      })).toHaveLength(1);
    } finally {
      observation.dispose();
      env.dispose();
    }
  });

  test("uses stable media events and keeps browser-policy play rejection quiet", async () => {
    const env = createHeadlessPlasmonEnvironment();
    const observation = observeDiagnostics(env.diagnostics);
    try {
      await env.ready;
      reportPhotosDecodeFailure();
      reportVideoPlaybackError();

      expect(await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.PhotosDecodeFailed,
        level: "error",
      })).toHaveLength(1);
      expect(await observation.settle({
        subsystem: DiagnosticSubsystem.NativeApp,
        event: DiagnosticEvent.NativeApp.VideoPlaybackError,
        level: "error",
      })).toHaveLength(1);

      expect(isExpectedVideoPlayRejection({ name: "NotAllowedError" })).toBe(true);
      expect(isExpectedVideoPlayRejection({ name: "AbortError" })).toBe(true);
      expect(isExpectedVideoPlayRejection({ name: "NotSupportedError" })).toBe(false);
      expect(isExpectedVideoPlayRejection(new Error("unexpected"))).toBe(false);
    } finally {
      observation.dispose();
      env.dispose();
    }
  });
});
