import { describe, expect, test } from "bun:test";
import { bootstrapFilesystem } from "./managed.ts";
import {
  CONFIGURATION_PATH,
  FilesystemConfigurationDocumentStore,
  ManagedConfigurationService,
  parseConfigurationDocument,
  reconcileConfigurationFile,
  reconcileConfigurationRoot,
  type ConfigurationDocumentDefinition,
} from "./configuration.ts";
import { MemoryFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import { CONFIGURATION_FILE_METADATA_KEY, OWNERSHIP_METADATA_KEY } from "./resourcePolicy.ts";
import { ProtectedManagedFsService } from "./protectedService.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const declaration = {
  owner: "Advanced",
  fileName: "settings.json",
  schema: "plasmon.test-advanced-settings",
  version: 2,
  reloadClass: "live",
  initialText: '{\n  "schema": "plasmon.test-advanced-settings",\n  "version": 2,\n  "enabled": true\n}\n',
  mime: "application/json",
} as const;

type Snapshot = { enabled: boolean };

const definition: ConfigurationDocumentDefinition<Snapshot> = {
  declaration,
  defaults: { enabled: true },
  defaultDocument: {
    schema: declaration.schema,
    version: declaration.version,
    enabled: true,
  },
  migrations: [{
    fromVersion: 1,
    toVersion: 2,
    migrate: (document) => ({
      ...document,
      enabled: document.legacyEnabled === true,
    }),
  }],
  parse: (document) => ({
    value: { enabled: typeof document.enabled === "boolean" ? document.enabled : true },
    ...(typeof document.enabled === "boolean" ? {} : {
      diagnostics: [{
        code: "invalid-enabled",
        message: "enabled must be boolean; using the default value",
      }],
    }),
  }),
  equals: (left, right) => left.enabled === right.enabled,
};

async function filesystem() {
  const raw = new PersistentFsService(new MemoryFsRepository());
  await bootstrapFilesystem(raw);
  return { raw, fs: new ProtectedManagedFsService(raw) };
}

async function fileText(fs: ProtectedManagedFsService): Promise<string> {
  const file = await fs.resolvePath(`${CONFIGURATION_PATH}/${declaration.owner}/${declaration.fileName}`);
  if (!file) throw new Error("configuration file is missing");
  return decoder.decode(await fs.read(file.id));
}

async function storeFixture() {
  const { raw, fs } = await filesystem();
  await reconcileConfigurationFile(raw, declaration);
  const configuration = new ManagedConfigurationService(raw, raw);
  const diagnostics: string[] = [];
  const diagnosticWaiters = new Map<string, Array<() => void>>();
  const store = new FilesystemConfigurationDocumentStore({
    fs,
    configuration,
    definition,
    onDiagnostic: (item) => {
      diagnostics.push(item.code);
      for (const resolve of diagnosticWaiters.get(item.code) ?? []) resolve();
      diagnosticWaiters.delete(item.code);
    },
  });
  await store.ready;
  const waitForDiagnostic = (code: string): Promise<void> => {
    if (diagnostics.includes(code)) return Promise.resolve();
    return new Promise((resolve) => {
      diagnosticWaiters.set(code, [...(diagnosticWaiters.get(code) ?? []), resolve]);
    });
  };
  return { raw, fs, store, diagnostics, waitForDiagnostic };
}

describe("managed configuration filesystem", () => {
  test("creates a protected root and owner directory while allowing declared file contents", async () => {
    const { raw, fs } = await filesystem();
    const root = await reconcileConfigurationRoot(raw);
    const owner = await new ManagedConfigurationService(raw, raw).ensureOwnerDirectory(declaration.owner);
    const file = await reconcileConfigurationFile(raw, declaration);

    expect(await raw.pathOf(root.id)).toBe(CONFIGURATION_PATH);
    expect(owner.metadata[OWNERSHIP_METADATA_KEY]).toBe("system-required");
    expect(file.metadata[OWNERSHIP_METADATA_KEY]).toBe("system-required");
    expect(file.metadata[CONFIGURATION_FILE_METADATA_KEY]).toEqual({
      format: "plasmon.configuration-file",
      version: 1,
      owner: declaration.owner,
      schema: declaration.schema,
      schemaVersion: declaration.version,
    });
    await expect(fs.mkdir(root.id, "Unexpected")).rejects.toThrow(/system-managed/u);
    await expect(fs.createFile(owner.id, "Unexpected.json")).rejects.toThrow(/system-managed/u);

    await fs.write(file.id, encoder.encode("user-authored"), { truncate: true });
    expect(decoder.decode(await fs.read(file.id))).toBe("user-authored");
    await expect(fs.remove(file.id)).rejects.toThrow(/protected/u);
    await expect(fs.setMetadata(file.id, { [CONFIGURATION_FILE_METADATA_KEY]: null })).rejects.toThrow(/protected/u);
    await expect(fs.remove(root.id, { recursive: true })).rejects.toThrow(/protected/u);
  });

  test("reconciliation is create-once, idempotent, and preserves user-authored bytes", async () => {
    const { raw } = await filesystem();
    const first = await reconcileConfigurationFile(raw, declaration);
    const authored = '{"schema":"plasmon.test-advanced-settings","version":2,"enabled":false,"future":7}\n';
    await raw.write(first.id, encoder.encode(authored), { truncate: true });
    const stableRevision = await raw.revision();

    const second = await reconcileConfigurationFile(raw, declaration);
    expect(second.id).toBe(first.id);
    expect(await raw.revision()).toBe(stableRevision);
    expect(decoder.decode(await raw.read(second.id))).toBe(authored);
  });
});

describe("owner document parsing and lifecycle", () => {
  test("uses canonical defaults, preserves unknown properties, and falls back for invalid known values", () => {
    const valid = JSON.stringify({
      schema: declaration.schema,
      version: declaration.version,
      enabled: false,
      future: { retained: true },
    });
    const parsed = (value: unknown) => parseConfigurationDocument(JSON.stringify(value), definition);
    const accepted = parsed(JSON.parse(valid));
    expect(accepted.accepted).toBe(true);
    expect(accepted.value).toEqual({ enabled: false });
    expect(accepted.document?.future).toEqual({ retained: true });

    const invalid = parsed({ schema: declaration.schema, version: declaration.version, enabled: "sometimes" });
    expect(invalid.accepted).toBe(true);
    expect(invalid.value).toEqual({ enabled: true });
    expect(invalid.diagnostics.map((item) => item.code)).toEqual(["invalid-enabled"]);

    const malformed = parseConfigurationDocument("{broken", definition);
    expect(malformed.accepted).toBe(false);
    expect(malformed.value).toEqual({ enabled: true });
    expect(malformed.diagnostics[0]?.code).toBe("malformed-json");
  });

  test("keeps last-known-good state on malformed live edits, uses defaults on cold start, and restores explicitly", async () => {
    const fixture = await storeFixture();
    try {
      const { fs, store, waitForDiagnostic } = fixture;
      await store.update((document) => ({ ...document, enabled: false }));
      expect(store.getSnapshot()).toEqual({ enabled: false });

      const file = await fs.resolvePath(`${CONFIGURATION_PATH}/${declaration.owner}/${declaration.fileName}`);
      if (!file) throw new Error("configuration file is missing");
      const malformedObserved = waitForDiagnostic("malformed-json");
      await fs.write(file.id, encoder.encode("{broken"), { truncate: true });
      await malformedObserved;
      expect(store.getSnapshot()).toEqual({ enabled: false });
      expect(await fileText(fs)).toBe("{broken");

      await store.restoreDefaults();
      expect(store.getSnapshot()).toEqual({ enabled: true });
      expect(JSON.parse(await fileText(fs)).enabled).toBe(true);
    } finally {
      fixture.store.dispose();
    }

    const cold = await filesystem();
    const file = await reconcileConfigurationFile(cold.raw, declaration);
    await cold.raw.write(file.id, encoder.encode("{broken"), { truncate: true });
    const configuration = new ManagedConfigurationService(cold.raw, cold.raw);
    const coldStore = new FilesystemConfigurationDocumentStore({
      fs: cold.fs,
      configuration,
      definition,
    });
    await coldStore.ready;
    expect(coldStore.getSnapshot()).toEqual({ enabled: true });
    expect(await fileText(cold.fs)).toBe("{broken");
    coldStore.dispose();
  });

  test("migrates explicitly, retains unknown properties, and reloads through one filesystem event seam", async () => {
    const fixture = await storeFixture();
    try {
      const { fs, store } = fixture;
      const file = await fs.resolvePath(`${CONFIGURATION_PATH}/${declaration.owner}/${declaration.fileName}`);
      if (!file) throw new Error("configuration file is missing");
      const migratedObserved = new Promise<void>((resolve) => {
        const stop = store.subscribe(() => {
          if (!store.getSnapshot().enabled) {
            stop();
            resolve();
          }
        });
      });
      await fs.write(file.id, encoder.encode(JSON.stringify({
        schema: declaration.schema,
        version: 1,
        legacyEnabled: false,
        future: "keep",
      })), { truncate: true });
      await migratedObserved;
      const migrated = JSON.parse(await fileText(fs));
      expect(migrated.version).toBe(2);
      expect(migrated.enabled).toBe(false);
      expect(migrated.future).toBe("keep");

      const updated = new Promise<void>((resolve) => {
        const stop = store.subscribe(() => {
          if (store.getSnapshot().enabled) {
            stop();
            resolve();
          }
        });
      });
      await fs.write(file.id, encoder.encode(JSON.stringify({
        schema: declaration.schema,
        version: 2,
        enabled: true,
        future: "still-keep",
      })), { truncate: true });
      await updated;
      expect(store.getSnapshot()).toEqual({ enabled: true });
    } finally {
      fixture.store.dispose();
    }
  });
});
