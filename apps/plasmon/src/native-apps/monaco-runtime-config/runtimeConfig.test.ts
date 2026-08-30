import { describe, expect, test } from "bun:test";
import { MemoryFsRepository } from "../../os/fs/repository.ts";
import { PersistentFsService } from "../../os/fs/service.ts";
import { ManagedProgramFilesService } from "../../os/fs/programFiles.ts";
import { ProtectedManagedFsService } from "../../os/fs/protectedService.ts";
import {
  DEFAULT_MONACO_RUNTIME_CONFIG_TEXT,
  MONACO_RUNTIME_CONFIG_FILE_NAME,
  MONACO_RUNTIME_CONFIG_PATH,
  MONACO_RUNTIME_CONFIG_SCHEMA,
  MonacoRuntimeConfigService,
  parseMonacoRuntimeConfigText,
  type MonacoRuntimeConfigDiagnostic,
  type MonacoRuntimeConfigDiagnosticCode,
} from "./runtimeConfig.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function createStore() {
  const raw = new PersistentFsService(new MemoryFsRepository());
  const fs = new ProtectedManagedFsService(raw);
  const diagnostics: MonacoRuntimeConfigDiagnostic[] = [];
  const waiters = new Map<MonacoRuntimeConfigDiagnosticCode, Array<() => void>>();
  const store = new MonacoRuntimeConfigService({
    fs,
    fsEvents: raw,
    programFiles: new ManagedProgramFilesService(raw),
    onDiagnostic: (item) => {
      diagnostics.push(item);
      const pending = waiters.get(item.code) ?? [];
      waiters.delete(item.code);
      for (const resolve of pending) resolve();
    },
  });
  await store.ready;
  const waitForDiagnostic = (code: MonacoRuntimeConfigDiagnosticCode): Promise<void> => {
    if (diagnostics.some((item) => item.code === code)) return Promise.resolve();
    return new Promise((resolve) => {
      waiters.set(code, [...(waiters.get(code) ?? []), resolve]);
    });
  };
  return { raw, fs, store, diagnostics, waitForDiagnostic };
}

async function configText(fs: ProtectedManagedFsService): Promise<string> {
  const file = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
  if (!file) throw new Error("Monaco runtime config is missing");
  return decoder.decode(await fs.read(file.id));
}

async function externalWrite(
  fs: ProtectedManagedFsService,
  store: MonacoRuntimeConfigService,
  text: string,
): Promise<void> {
  const file = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
  if (!file) throw new Error("Monaco runtime config is missing");
  const changed = new Promise<void>((resolve) => {
    const unsubscribe = store.subscribe(() => {
      unsubscribe();
      resolve();
    });
  });
  await fs.write(file.id, encoder.encode(text), { truncate: true });
  await changed;
}

describe("Monaco runtime configuration parsing", () => {
  test("accepts the versioned schema and derives the default minimap value", () => {
    const parsed = parseMonacoRuntimeConfigText(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT);
    expect(parsed.accepted).toBe(true);
    expect(parsed.snapshot.schema).toBe(MONACO_RUNTIME_CONFIG_SCHEMA);
    expect(parsed.snapshot.editor.minimap.enabled).toBe(true);
    expect(parsed.diagnostics).toEqual([]);
  });

  test("unknown properties do not affect effective configuration", () => {
    const parsed = parseMonacoRuntimeConfigText(JSON.stringify({
      schema: MONACO_RUNTIME_CONFIG_SCHEMA,
      future: { retained: true },
      editor: {
        futureEditorProperty: "keep",
        minimap: { enabled: false, futureMinimapProperty: 7 },
      },
    }));
    expect(parsed.accepted).toBe(true);
    expect(parsed.snapshot.editor.minimap.enabled).toBe(false);
    expect(parsed.diagnostics).toEqual([]);
  });

  test("invalid known minimap values fall back with a bounded diagnostic", () => {
    const parsed = parseMonacoRuntimeConfigText(JSON.stringify({
      schema: MONACO_RUNTIME_CONFIG_SCHEMA,
      editor: { minimap: { enabled: "sometimes" } },
    }));
    expect(parsed.accepted).toBe(true);
    expect(parsed.snapshot.editor.minimap.enabled).toBe(true);
    expect(parsed.diagnostics.map((item) => item.code)).toEqual(["invalid-minimap-enabled"]);
  });

  test("malformed JSON and unsupported schemas fail closed to defaults", () => {
    const malformed = parseMonacoRuntimeConfigText("{not json");
    expect(malformed.accepted).toBe(false);
    expect(malformed.snapshot.editor.minimap.enabled).toBe(true);
    expect(malformed.diagnostics[0]?.code).toBe("malformed-json");

    const unsupported = parseMonacoRuntimeConfigText(JSON.stringify({ schema: "plasmon.monaco-runtime-config-v2" }));
    expect(unsupported.accepted).toBe(false);
    expect(unsupported.diagnostics[0]?.code).toBe("unsupported-schema");
  });
});

describe("Monaco runtime configuration service", () => {
  test("creates the canonical editable file once and preserves user-authored bytes", async () => {
    const { raw, fs, store } = await createStore();
    try {
      const file = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
      expect(file?.name).toBe(MONACO_RUNTIME_CONFIG_FILE_NAME);
      expect(file?.mime).toBe("application/json");
      expect(await configText(fs)).toBe(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT);

      const authored = `${JSON.stringify({
        schema: MONACO_RUNTIME_CONFIG_SCHEMA,
        editor: { minimap: { enabled: false } },
        userExtension: { keep: "exactly" },
      }, null, 2)}\n`;
      await externalWrite(fs, store, authored);
      expect(store.getSnapshot().editor.minimap.enabled).toBe(false);
      expect(await configText(fs)).toBe(authored);

      const stableRevision = await raw.revision();
      await store.ready;
      expect(await raw.revision()).toBe(stableRevision);
      expect(await configText(fs)).toBe(authored);
    } finally {
      store.dispose();
    }
  });

  test("filesystem invalidation publishes one effective snapshot to every subscriber", async () => {
    const { fs, store } = await createStore();
    const first: boolean[] = [];
    const second: boolean[] = [];
    const stopFirst = store.subscribe(() => first.push(store.getSnapshot().editor.minimap.enabled));
    const stopSecond = store.subscribe(() => second.push(store.getSnapshot().editor.minimap.enabled));
    try {
      await externalWrite(fs, store, JSON.stringify({
        schema: MONACO_RUNTIME_CONFIG_SCHEMA,
        editor: { minimap: { enabled: false } },
      }));
      expect(first).toEqual([false]);
      expect(second).toEqual([false]);

      await store.setMinimapEnabled(true);
      expect(first.at(-1)).toBe(true);
      expect(second.at(-1)).toBe(true);
    } finally {
      stopFirst();
      stopSecond();
      store.dispose();
    }
  });

  test("toolbar-style writes preserve unknown properties instead of normalizing the file", async () => {
    const { fs, store } = await createStore();
    try {
      await externalWrite(fs, store, JSON.stringify({
        schema: MONACO_RUNTIME_CONFIG_SCHEMA,
        rootUnknown: { answer: 42 },
        editor: {
          editorUnknown: ["keep"],
          minimap: { enabled: false, minimapUnknown: "keep" },
        },
      }));
      await store.setMinimapEnabled(true);
      const document = JSON.parse(await configText(fs));
      expect(document.rootUnknown).toEqual({ answer: 42 });
      expect(document.editor.editorUnknown).toEqual(["keep"]);
      expect(document.editor.minimap.minimapUnknown).toBe("keep");
      expect(document.editor.minimap.enabled).toBe(true);
    } finally {
      store.dispose();
    }
  });

  test("invalid known values publish defaults without rewriting the user's document", async () => {
    const { raw, fs, store, diagnostics, waitForDiagnostic } = await createStore();
    try {
      const invalid = JSON.stringify({
        schema: MONACO_RUNTIME_CONFIG_SCHEMA,
        editor: { minimap: { enabled: 1 } },
      });
      const file = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
      if (!file) throw new Error("Monaco runtime config is missing");
      const observed = waitForDiagnostic("invalid-minimap-enabled");
      await fs.write(file.id, encoder.encode(invalid), { truncate: true });
      await observed;
      const revisionAfterWrite = await raw.revision();
      expect(store.getSnapshot().editor.minimap.enabled).toBe(true);
      expect(await configText(fs)).toBe(invalid);
      expect(await raw.revision()).toBe(revisionAfterWrite);
      expect(diagnostics.filter((item) => item.code === "invalid-minimap-enabled")).toHaveLength(1);
    } finally {
      store.dispose();
    }
  });

  test("malformed JSON retains last-known-good state and is not rewritten automatically", async () => {
    const { raw, fs, store, waitForDiagnostic } = await createStore();
    try {
      await store.setMinimapEnabled(false);
      expect(store.getSnapshot().editor.minimap.enabled).toBe(false);
      const malformed = "{broken";
      const file = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
      if (!file) throw new Error("Monaco runtime config is missing");
      const observed = waitForDiagnostic("malformed-json");
      await fs.write(file.id, encoder.encode(malformed), { truncate: true });
      await observed;
      const revisionAfterWrite = await raw.revision();
      expect(store.getSnapshot().editor.minimap.enabled).toBe(false);
      expect(await configText(fs)).toBe(malformed);
      expect(await raw.revision()).toBe(revisionAfterWrite);
    } finally {
      store.dispose();
    }
  });

  test("cold-start malformed JSON falls back to defaults until explicit restore", async () => {
    const raw = new PersistentFsService(new MemoryFsRepository());
    const programFiles = new ManagedProgramFilesService(raw);
    const file = await programFiles.ensureRuntimeFile("MonacoEditor", MONACO_RUNTIME_CONFIG_FILE_NAME, {
      initialBytes: encoder.encode("{broken"),
      mime: "application/json",
    });
    await raw.write(file.id, encoder.encode("{broken"), { truncate: true });
    const fs = new ProtectedManagedFsService(raw);
    const diagnostics: MonacoRuntimeConfigDiagnostic[] = [];
    const store = new MonacoRuntimeConfigService({
      fs,
      fsEvents: raw,
      programFiles,
      onDiagnostic: (item) => diagnostics.push(item),
    });
    try {
      await store.ready;
      expect(store.getSnapshot().editor.minimap.enabled).toBe(true);
      expect(await configText(fs)).toBe("{broken");
      expect(diagnostics.some((item) => item.code === "malformed-json")).toBe(true);

      await store.restoreDefaults();
      expect(await configText(fs)).toBe(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT);
      expect(store.getSnapshot().editor.minimap.enabled).toBe(true);
    } finally {
      store.dispose();
    }
  });

  test("removing the live config is observed and recreates the canonical default file", async () => {
    const { fs, store } = await createStore();
    try {
      await store.setMinimapEnabled(false);
      const file = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
      if (!file) throw new Error("Monaco runtime config is missing");
      const restored = new Promise<void>((resolve) => {
        const unsubscribe = store.subscribe(() => {
          if (store.getSnapshot().editor.minimap.enabled) {
            unsubscribe();
            resolve();
          }
        });
      });
      await fs.remove(file.id);
      await restored;
      const recreated = await fs.resolvePath(MONACO_RUNTIME_CONFIG_PATH);
      expect(recreated).not.toBeNull();
      expect(recreated?.id).not.toBe(file.id);
      expect(await configText(fs)).toBe(DEFAULT_MONACO_RUNTIME_CONFIG_TEXT);
    } finally {
      store.dispose();
    }
  });
});
