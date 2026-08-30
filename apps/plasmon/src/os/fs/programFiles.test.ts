import { test } from "bun:test";
import assert from "node:assert/strict";
import { MemoryFsRepository } from "./repository.ts";
import { PersistentFsService } from "./service.ts";
import {
  ManagedProgramFilesService,
  PROGRAM_FILES_METADATA_KEY,
  PROGRAM_FILES_PATH,
  PROGRAM_FILES_RECONCILIATION_VERSION,
  reconcileProgramFilesRoot,
  reconcileProgramFilesRuntimeDirectory,
  reconcileProgramFilesRuntimeFile,
} from "./programFiles.ts";
import { ProtectedManagedFsService } from "./protectedService.ts";
import { OWNERSHIP_METADATA_KEY } from "./resourcePolicy.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function fresh() {
  const raw = new PersistentFsService(new MemoryFsRepository());
  const desktop = await raw.resolvePath("/Desktop");
  if (!desktop) throw new Error("Fresh filesystem did not initialize Desktop");
  return { raw, desktop };
}

test("Program Files root reconciliation is versioned, idempotent, and preserves contents", async () => {
  const { raw } = await fresh();
  const first = await reconcileProgramFilesRoot(raw);
  assert.equal(await raw.pathOf(first.id), PROGRAM_FILES_PATH);
  assert.equal(first.metadata[OWNERSHIP_METADATA_KEY], "system-required");
  assert.deepEqual(first.metadata[PROGRAM_FILES_METADATA_KEY], {
    format: "plasmon.program-files",
    version: PROGRAM_FILES_RECONCILIATION_VERSION,
  });

  const preserved = await raw.mkdir(first.id, "ExistingRuntime");
  await raw.setMetadata(preserved.id, { keep: "user-state" });
  const stableRevision = await raw.revision();
  const second = await reconcileProgramFilesRoot(raw);
  assert.equal(second.id, first.id);
  assert.equal(await raw.revision(), stableRevision, "unchanged reconciliation must not churn revisions");
  assert.equal((await raw.resolvePath(`${PROGRAM_FILES_PATH}/ExistingRuntime`))?.id, preserved.id);

  await raw.setMetadata(first.id, {
    [OWNERSHIP_METADATA_KEY]: "user",
    [PROGRAM_FILES_METADATA_KEY]: null,
  });
  const repaired = await reconcileProgramFilesRoot(raw);
  assert.equal(repaired.id, first.id);
  assert.equal(repaired.metadata[OWNERSHIP_METADATA_KEY], "system-required");
  assert.deepEqual(repaired.metadata[PROGRAM_FILES_METADATA_KEY], {
    format: "plasmon.program-files",
    version: PROGRAM_FILES_RECONCILIATION_VERSION,
  });
  const preservedAfterRepair = await raw.resolvePath(`${PROGRAM_FILES_PATH}/ExistingRuntime`);
  assert.equal(preservedAfterRepair?.id, preserved.id);
  assert.equal(preservedAfterRepair?.metadata.keep, "user-state");
});

test("runtime owners share one Program Files directory seam without installation semantics", async () => {
  const { raw } = await fresh();
  const root = await reconcileProgramFilesRoot(raw);
  const existing = await raw.mkdir(root.id, "MonacoEditor");
  await raw.setMetadata(existing.id, { keep: "runtime-owned" });
  const worker = await raw.createFile(existing.id, "editor.worker.js", { mime: "text/javascript" });

  const first = await reconcileProgramFilesRuntimeDirectory(raw, "MonacoEditor");
  assert.equal(first.id, existing.id);
  assert.equal(first.metadata[OWNERSHIP_METADATA_KEY], "system-required");
  assert.equal(first.metadata.keep, "runtime-owned");
  assert.equal((await raw.resolvePath(`${PROGRAM_FILES_PATH}/MonacoEditor/editor.worker.js`))?.id, worker.id);

  const stableRevision = await raw.revision();
  const service = new ManagedProgramFilesService(raw);
  const second = await service.ensureRuntimeDirectory("MonacoEditor");
  assert.equal(second.id, first.id);
  assert.equal(await raw.revision(), stableRevision);

  const future = await service.ensureRuntimeDirectory("FutureRuntime");
  assert.equal(await raw.pathOf(future.id), `${PROGRAM_FILES_PATH}/FutureRuntime`);
  assert.equal(future.metadata[OWNERSHIP_METADATA_KEY], "system-required");
  assert.equal(future.metadata["plasmon.neutronApp"], undefined);
  assert.equal(future.metadata["plasmon.systemApp"], undefined);

  await assert.rejects(() => service.ensureRuntimeDirectory("../escape"), /Invalid Program Files runtime directory name/u);
  await assert.rejects(() => service.ensureRuntimeDirectory(" nested "), /Invalid Program Files runtime directory name/u);
});

test("runtime owners can create one user-writable file without weakening the protected parent", async () => {
  const { raw } = await fresh();
  const initialBytes = encoder.encode('{"enabled":true}\n');
  const created = await reconcileProgramFilesRuntimeFile(raw, "MonacoEditor", "config.json", {
    initialBytes,
    mime: "application/json",
    metadata: { "plasmon.runtimeConfig": "monaco" },
  });
  const path = `${PROGRAM_FILES_PATH}/MonacoEditor/config.json`;
  assert.equal(await raw.pathOf(created.id), path);
  assert.equal(created.mime, "application/json");
  assert.equal(created.metadata["plasmon.runtimeConfig"], "monaco");

  const fs = new ProtectedManagedFsService(raw);
  const userBytes = encoder.encode('{"enabled":false,"keep":"user"}\n');
  await fs.write(created.id, userBytes, { truncate: true });
  assert.equal(decoder.decode(await fs.read(created.id)), decoder.decode(userBytes));

  const stableRevision = await raw.revision();
  const service = new ManagedProgramFilesService(raw);
  const reconciled = await service.ensureRuntimeFile("MonacoEditor", "config.json", {
    initialBytes,
    mime: "application/json",
  });
  assert.equal(reconciled.id, created.id);
  assert.equal(await raw.revision(), stableRevision, "existing runtime file reconciliation must not rewrite user bytes");
  assert.equal(decoder.decode(await raw.read(reconciled.id)), decoder.decode(userBytes));

  const runtime = await raw.resolvePath(`${PROGRAM_FILES_PATH}/MonacoEditor`);
  if (!runtime) throw new Error("Monaco runtime directory is missing");
  await assert.rejects(() => fs.createFile(runtime.id, "other.json"), /system-managed/u);
  await assert.rejects(
    () => service.ensureRuntimeFile("MonacoEditor", "../escape.json", { initialBytes }),
    /Invalid Program Files runtime file name/u,
  );
});

test("Program Files remains protected from generic public filesystem mutation", async () => {
  const { raw, desktop } = await fresh();
  const root = await reconcileProgramFilesRoot(raw);
  const runtime = await reconcileProgramFilesRuntimeDirectory(raw, "MonacoEditor");
  const userFile = await raw.createFile(desktop.id, "notes.txt", { mime: "text/plain" });
  const fs = new ProtectedManagedFsService(raw);

  await assert.rejects(() => fs.mkdir(root.id, "GenericApp"), /system-managed/u);
  await assert.rejects(() => fs.createFile(runtime.id, "payload.bin"), /system-managed/u);
  await assert.rejects(() => fs.move(userFile.id, root.id), /system-managed/u);
  await assert.rejects(() => fs.remove(root.id, { recursive: true }), /protected/u);
  assert.ok(await raw.resolvePath(PROGRAM_FILES_PATH));
  assert.ok(await raw.resolvePath(`${PROGRAM_FILES_PATH}/MonacoEditor`));
});
