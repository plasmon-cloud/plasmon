import { test } from "bun:test";
import assert from "node:assert/strict";
import type {
  AssociationRegistry,
  NativeAppRegistry,
  NeutronBridge,
  OpenService,
  ProcessController,
} from "../contracts/index.ts";
import { createFilesystemCore } from "./core.ts";
import { CONFIGURATION_PATH } from "./configuration.ts";
import { PROGRAM_FILES_PATH } from "./programFiles.ts";
import { MemoryFsRepository } from "./repository.ts";
import { OWNERSHIP_METADATA_KEY } from "./resourcePolicy.ts";
import { PersistentFsService } from "./service.ts";

function dependencies(raw: PersistentFsService) {
  return {
    fs: raw,
    nativeApps: { list: () => [] } as unknown as NativeAppRegistry,
    neutron: {
      loadElements: async () => [],
      subscribe: () => () => undefined,
    } as unknown as NeutronBridge,
    associations: {} as AssociationRegistry,
    openService: {} as OpenService,
    process: {} as ProcessController,
  };
}

test("filesystem core ready reconciles one stable MonacoEditor Program Files runtime", async () => {
  const raw = new PersistentFsService(new MemoryFsRepository());

  const firstCore = createFilesystemCore(dependencies(raw));
  const earlyRuntimePromise = firstCore.programFiles.ensureRuntimeDirectory("MonacoEditor");
  await firstCore.ready;
  const first = await raw.resolvePath(`${PROGRAM_FILES_PATH}/MonacoEditor`);
  assert.ok(first);
  const configuration = await firstCore.configuration.root();
  assert.equal(await raw.pathOf(configuration.id), CONFIGURATION_PATH);
  const earlyRuntime = await earlyRuntimePromise;
  assert.equal(earlyRuntime.id, first.id, "an early runtime consumer must share the core bootstrap identity");
  assert.equal(first.kind, "directory");
  assert.equal(first.metadata[OWNERSHIP_METADATA_KEY], "system-required");
  assert.equal(await raw.resolvePath("/System/MonacoEditor.sys"), null);

  const preserved = await raw.createFile(first.id, "runtime-state.bin", { mime: "application/octet-stream" });
  await raw.write(preserved.id, new TextEncoder().encode("preserve-me"), { truncate: true });
  await raw.setMetadata(first.id, { keep: "runtime-owned" });
  firstCore.dispose();

  const secondCore = createFilesystemCore(dependencies(raw));
  await secondCore.ready;
  const second = await raw.resolvePath(`${PROGRAM_FILES_PATH}/MonacoEditor`);
  assert.ok(second);
  assert.equal(second.id, first.id);
  assert.equal(second.metadata.keep, "runtime-owned");
  assert.equal(second.metadata[OWNERSHIP_METADATA_KEY], "system-required");
  const preservedAfterReconcile = await raw.resolvePath(`${PROGRAM_FILES_PATH}/MonacoEditor/runtime-state.bin`);
  assert.equal(preservedAfterReconcile?.id, preserved.id);
  assert.equal(
    new TextDecoder().decode(await raw.read(preserved.id)),
    "preserve-me",
    "runtime bytes must survive repeated filesystem-core reconciliation",
  );
  assert.equal(await raw.resolvePath("/System/MonacoEditor.sys"), null);

  secondCore.dispose();
});
