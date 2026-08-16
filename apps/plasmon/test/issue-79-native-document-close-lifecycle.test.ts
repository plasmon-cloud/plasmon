import { expect, test } from "bun:test";
import { DocumentCloseModel } from "../src/native-apps/text/documentClose.ts";
import { DocumentSession } from "../src/native-apps/text/document.ts";
import type { NodeId, ProcessId } from "../src/os/contracts/index.ts";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
} from "./headlessEnvironment.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface OpenDocumentLifecycle {
  readonly processId: ProcessId;
  readonly nodeId: NodeId;
  readonly session: DocumentSession;
  readonly close: DocumentCloseModel;
  dispose(): void;
}

function expectOneProcessWindow(environment: HeadlessPlasmonEnvironment, processId: ProcessId): void {
  const processes = environment.processes();
  expect(processes).toHaveLength(1);
  expect(processes[0]?.id).toBe(processId);
  expect(processes[0]?.state).toBe("running");

  const windows = environment.windows();
  expect(windows).toHaveLength(1);
  expect(windows[0]?.processId).toBe(processId);
  expect(windows[0]?.id).toBe(processes[0]?.windowId);
}

function expectClosed(environment: HeadlessPlasmonEnvironment): void {
  expect(environment.processes()).toHaveLength(0);
  expect(environment.windows()).toHaveLength(0);
}

async function openTextDocument(
  environment: HeadlessPlasmonEnvironment,
  path: string,
): Promise<OpenDocumentLifecycle> {
  await environment.open(path);
  const process = environment.processes()[0];
  if (!process?.target.nodeId) throw new Error(`Text process did not open ${path}`);
  expect(process.handlerId).toBe("native:text");

  const session = new DocumentSession(environment.services.fs);
  await session.setTarget(process.target.nodeId);
  expect(session.snapshot().status).toBe("ready");

  const close = new DocumentCloseModel(session);
  const unregister = environment.services.process.registerCloseHandler(
    process.id,
    (request) => close.requestClose(request),
  );

  return {
    processId: process.id,
    nodeId: process.target.nodeId,
    session,
    close,
    dispose() {
      unregister();
      close.dispose();
      session.dispose();
    },
  };
}

test("native document close lifecycle stays coherent across Document, Process, and Windowing", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await environment.node("/Documents");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

    const node = await environment.services.fs.createFile(documents.id, "close-lifecycle.txt", { mime: "text/plain" });
    await environment.services.fs.write(node.id, encoder.encode("baseline"), { truncate: true });

    // Clean document: Native Apps allows the Process close synchronously and
    // Process removes both its own record and the Windowing-owned window.
    let lifecycle = await openTextDocument(environment, "/Documents/close-lifecycle.txt");
    expectOneProcessWindow(environment, lifecycle.processId);
    expect(environment.services.process.close(lifecycle.processId)).toBe(true);
    expectClosed(environment);
    lifecycle.dispose();

    // Dirty document: the Native Apps model defers Process close. A repeated
    // ordinary close cannot bypass the same pending decision. Cancel returns
    // lifecycle authority to Process without tearing down either record.
    lifecycle = await openTextDocument(environment, "/Documents/close-lifecycle.txt");
    lifecycle.session.edit("cancelled edit");
    expect(environment.services.process.close(lifecycle.processId)).toBe(false);
    expect(lifecycle.close.snapshot().pending).toBe(true);
    expect(environment.services.process.close(lifecycle.processId)).toBe(false);
    expect(lifecycle.close.snapshot().pending).toBe(true);
    expectOneProcessWindow(environment, lifecycle.processId);

    expect(lifecycle.close.cancelClose()).toBe(true);
    expect(lifecycle.close.snapshot().pending).toBe(false);
    expectOneProcessWindow(environment, lifecycle.processId);
    expect(decoder.decode(await environment.services.fs.read(lifecycle.nodeId))).toBe("baseline");

    // A later close can defer again; Discard completes the exact pending
    // Process request without persisting the dirty edit.
    expect(environment.services.process.close(lifecycle.processId)).toBe(false);
    expect(lifecycle.close.discardAndClose()).toBe(true);
    expectClosed(environment);
    expect(decoder.decode(await environment.services.fs.read(lifecycle.nodeId))).toBe("baseline");
    lifecycle.dispose();

    // Save resolves the pending close only after the production DocumentSession
    // has persisted the edit, then Process tears down the matching window.
    lifecycle = await openTextDocument(environment, "/Documents/close-lifecycle.txt");
    lifecycle.session.edit("saved before close");
    expect(environment.services.process.close(lifecycle.processId)).toBe(false);
    expect(lifecycle.close.snapshot().pending).toBe(true);
    expect(await lifecycle.close.saveAndClose()).toBe(true);
    expectClosed(environment);
    expect(decoder.decode(await environment.services.fs.read(lifecycle.nodeId))).toBe("saved before close");
    lifecycle.dispose();
  } finally {
    environment.dispose();
  }
});
