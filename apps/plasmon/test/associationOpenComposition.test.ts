import { expect, test } from "bun:test";
import { OpenWithServiceModel } from "../src/os/associations/index.ts";
import type { NodeId } from "../src/os/contracts/index.ts";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
} from "./headlessEnvironment.ts";

function expectSingleNativeOpen(
  environment: HeadlessPlasmonEnvironment,
  handlerId: string,
  nodeId: NodeId,
): void {
  const processes = environment.processes();
  expect(processes).toHaveLength(1);
  expect(processes[0]?.handlerId).toBe(handlerId);
  expect(processes[0]?.target.nodeId).toBe(nodeId);
  expect(processes[0]?.windowId).not.toBeNull();

  const windows = environment.windows();
  expect(windows).toHaveLength(1);
  expect(windows[0]?.id).toBe(processes[0]?.windowId);
  expect(windows[0]?.processId).toBe(processes[0]?.id);
}

function closeAllProcesses(environment: HeadlessPlasmonEnvironment): void {
  for (const process of environment.processes()) environment.services.process.close(process.id);
  expect(environment.processes()).toHaveLength(0);
  expect(environment.windows()).toHaveLength(0);
}

test("production filesystem associations compose through OpenService and persist user defaults across reconstruction", async () => {
  const first = createHeadlessPlasmonEnvironment();
  const repository = first.repository;

  try {
    await first.ready;
    const documents = await first.node("/Documents");
    expect(documents?.kind).toBe("directory");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

    const extensionFile = await first.services.fs.createFile(documents.id, "composed.md");
    const mimeFile = await first.services.fs.createFile(documents.id, "cover", { mime: "image/png" });

    expect((await first.services.associations.resolve(extensionFile)).map(({ id }) => id).slice(0, 2)).toEqual([
      "native:markdown",
      "native:text",
    ]);
    await first.open("/Documents/composed.md");
    expectSingleNativeOpen(first, "native:markdown", extensionFile.id);
    closeAllProcesses(first);

    expect((await first.services.associations.resolve(mimeFile)).map(({ id }) => id).slice(0, 2)).toEqual([
      "native:photos",
      "native:text",
    ]);
    await first.open("/Documents/cover");
    expectSingleNativeOpen(first, "native:photos", mimeFile.id);
    closeAllProcesses(first);

    const openWith = new OpenWithServiceModel(first.services.associations, first.services.openService);
    expect(await openWith.setDefault(extensionFile, "native:text")).toBe("extension:.md");
    expect((await first.services.associations.resolve(extensionFile)).map(({ id }) => id).slice(0, 2)).toEqual([
      "native:text",
      "native:markdown",
    ]);

    await first.open("/Documents/composed.md");
    expectSingleNativeOpen(first, "native:text", extensionFile.id);
  } finally {
    first.dispose();
  }

  const reconstructed = createHeadlessPlasmonEnvironment({ repository });
  try {
    await reconstructed.ready;
    const extensionFile = await reconstructed.node("/Documents/composed.md");
    expect(extensionFile?.kind).toBe("file");
    if (!extensionFile || extensionFile.kind !== "file") throw new Error("Persisted Markdown file is unavailable");

    expect((await reconstructed.services.associations.resolve(extensionFile)).map(({ id }) => id).slice(0, 2)).toEqual([
      "native:text",
      "native:markdown",
    ]);
    await reconstructed.open("/Documents/composed.md");
    expectSingleNativeOpen(reconstructed, "native:text", extensionFile.id);
    closeAllProcesses(reconstructed);

    const documents = await reconstructed.node("/Documents");
    expect(documents?.kind).toBe("directory");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable after reconstruction");
    const unsupported = await reconstructed.services.fs.createFile(documents.id, "opaque.resource");

    expect(await reconstructed.services.associations.resolve(unsupported)).toEqual([]);
    await expect(reconstructed.open("/Documents/opaque.resource")).rejects.toThrow(
      "No compatible application is registered for opaque.resource",
    );
    expect(reconstructed.processes()).toHaveLength(0);
    expect(reconstructed.windows()).toHaveLength(0);
  } finally {
    reconstructed.dispose();
  }
});
