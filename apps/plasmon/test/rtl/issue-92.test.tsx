import { expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createHeadlessPlasmonEnvironment } from "../headlessEnvironment.ts";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import { FileOperationState } from "../../src/os/file-manager/operation-state.ts";
import type { FsNode, FsService, NodeId } from "../../src/os/contracts/index.ts";

function delayedMoves(fs: FsService, started: () => void, release: Promise<void>): FsService {
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property !== "move") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["move"]>) => {
        started();
        await release;
        return target.move(...args);
      };
    },
  });
}

function failMoveFor(fs: FsService, failedId: NodeId, moved: () => void): FsService {
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property !== "move") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["move"]>) => {
        const [nodeId] = args;
        if (nodeId === failedId) throw new Error("expected move failure");
        moved();
        return target.move(...args);
      };
    },
  });
}

function countMoves(fs: FsService, moved: () => void): FsService {
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property !== "move") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["move"]>) => {
        moved();
        return target.move(...args);
      };
    },
  });
}

async function directory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

function installPointerCapture(element: HTMLElement): void {
  Object.defineProperty(element, "setPointerCapture", { value: () => undefined, configurable: true });
  Object.defineProperty(element, "releasePointerCapture", { value: () => undefined, configurable: true });
  Object.defineProperty(element, "hasPointerCapture", { value: () => false, configurable: true });
}

function selectEntry(element: HTMLElement, pointerId: number, ctrlKey = false): void {
  installPointerCapture(element);
  fireEvent.pointerDown(element, { button: 0, pointerId, clientX: 10, clientY: 10, ctrlKey });
  fireEvent.pointerUp(element, { button: 0, pointerId, clientX: 10, clientY: 10 });
}

function dragEntry(element: HTMLElement, pointerId: number): void {
  installPointerCapture(element);
  fireEvent.pointerDown(element, { button: 0, pointerId, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(element, { pointerId, clientX: 200, clientY: 10 });
  fireEvent.pointerUp(element, { button: 0, pointerId, clientX: 200, clientY: 10 });
}

async function prepareMoveFixture(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>) {
  await environment.ready;
  const documents = await directory(environment, "/Documents");
  const target = await environment.services.fs.mkdir(documents.id, "Move Target");
  const first = await environment.services.fs.createFile(documents.id, "drag-one.txt", { mime: "text/plain" });
  const second = await environment.services.fs.createFile(documents.id, "drag-two.txt", { mime: "text/plain" });
  return { documents, target, first, second };
}

test("#92 multi-item drag move exposes running state and truthful completion", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let moveStarted = false;
  let targetElement: HTMLElement | null = null;
  const originalElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => targetElement;

  try {
    const { documents } = await prepareMoveFixture(environment);
    const operationState = new FileOperationState();
    const fs = delayedMoves(environment.services.fs, () => { moveStarted = true; }, gate);
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
        operationState={operationState}
      />,
    );

    await waitFor(() => expect(view.getByRole("option", { name: "Move Target" })).toBeDefined());
    const first = view.getByRole("option", { name: "drag-one.txt" });
    const second = view.getByRole("option", { name: "drag-two.txt" });
    targetElement = view.getByRole("option", { name: "Move Target" });
    selectEntry(first, 1);
    selectEntry(second, 2, true);
    dragEntry(second, 3);

    await waitFor(() => expect(moveStarted).toBe(true));
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Moving 1 of 2: drag-one.txt"));
    expect(operationState.snapshot()).toMatchObject({
      kind: "move",
      status: "running",
      totalItems: 2,
      currentIndex: 1,
      currentItem: "drag-one.txt",
    });

    await act(async () => { release(); });
    await waitFor(() => expect(operationState.snapshot().status).toBe("completed"));
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("Moved 2 items."));
  } finally {
    release?.();
    document.elementFromPoint = originalElementFromPoint;
    cleanup();
    environment.dispose();
  }
});

test("#92 multi-item drag move surfaces partial success and failure", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let targetElement: HTMLElement | null = null;
  let moves = 0;
  const originalElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => targetElement;

  try {
    const { documents, target, first, second } = await prepareMoveFixture(environment);
    const operationState = new FileOperationState();
    const fs = failMoveFor(environment.services.fs, second.id, () => { moves += 1; });
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
        operationState={operationState}
      />,
    );

    await waitFor(() => expect(view.getByRole("option", { name: "Move Target" })).toBeDefined());
    const firstEntry = view.getByRole("option", { name: "drag-one.txt" });
    const secondEntry = view.getByRole("option", { name: "drag-two.txt" });
    targetElement = view.getByRole("option", { name: "Move Target" });
    selectEntry(firstEntry, 11);
    selectEntry(secondEntry, 12, true);
    dragEntry(secondEntry, 13);

    await waitFor(() => expect(operationState.snapshot().status).toBe("failed"));
    expect(operationState.snapshot()).toMatchObject({
      kind: "move",
      totalItems: 2,
      processedItems: 2,
      succeededItems: 1,
      failedItems: 1,
      failures: [{ item: "drag-two.txt", message: "expected move failure" }],
    });
    expect(moves).toBe(1);
    expect((await environment.services.fs.stat(first.id)).parentId).toBe(target.id);
    expect((await environment.services.fs.stat(second.id)).parentId).toBe(documents.id);
    await waitFor(() => expect(view.getByRole("status").textContent).toBe(
      "Move stopped: 1 item moved, 1 item failed (drag-two.txt: expected move failure).",
    ));
    expect(view.getByRole("alert").textContent).toContain("expected move failure");
  } finally {
    document.elementFromPoint = originalElementFromPoint;
    cleanup();
    environment.dispose();
  }
});

test("#92 drag move refuses to start while another FileManager operation is active", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let targetElement: HTMLElement | null = null;
  let moves = 0;
  const originalElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => targetElement;

  try {
    const { documents } = await prepareMoveFixture(environment);
    const operationState = new FileOperationState();
    expect(operationState.begin("paste", 1)).toBe(true);
    const fs = countMoves(environment.services.fs, () => { moves += 1; });
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
        operationState={operationState}
      />,
    );

    await waitFor(() => expect(view.getByRole("option", { name: "Move Target" })).toBeDefined());
    const first = view.getByRole("option", { name: "drag-one.txt" });
    const second = view.getByRole("option", { name: "drag-two.txt" });
    targetElement = view.getByRole("option", { name: "Move Target" });
    selectEntry(first, 21);
    selectEntry(second, 22, true);
    dragEntry(second, 23);

    await waitFor(() => expect(view.getByText("Another file operation is already running")).toBeDefined());
    expect(moves).toBe(0);
    expect(operationState.snapshot()).toMatchObject({ kind: "paste", status: "running" });
  } finally {
    document.elementFromPoint = originalElementFromPoint;
    cleanup();
    environment.dispose();
  }
});