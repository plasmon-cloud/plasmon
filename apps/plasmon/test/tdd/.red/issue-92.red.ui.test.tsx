import { expect, test } from "bun:test";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { FileManager } from "../../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../../src/os/file-manager/model.ts";
import type { FsNode, FsService } from "../../../src/os/contracts/index.ts";

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

async function directory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("#92 RTL RED — multi-item drag move exposes truthful running state while FsService.move is pending", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let moveStarted = false;
  let targetElement: HTMLElement | null = null;
  const originalElementFromPoint = document.elementFromPoint;
  document.elementFromPoint = () => targetElement;

  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const target = await environment.services.fs.mkdir(documents.id, "Move Target");
    await environment.services.fs.createFile(documents.id, "drag-one.txt", { mime: "text/plain" });
    await environment.services.fs.createFile(documents.id, "drag-two.txt", { mime: "text/plain" });
    const fs = delayedMoves(environment.services.fs, () => { moveStarted = true; }, gate);
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
      />,
    );

    await waitFor(() => expect(view.getByRole("option", { name: "Move Target" })).toBeDefined());
    const first = view.getByRole("option", { name: "drag-one.txt" });
    const second = view.getByRole("option", { name: "drag-two.txt" });
    targetElement = view.getByRole("option", { name: "Move Target" });
    for (const [element, pointerId, extra] of [
      [first, 1, {}],
      [second, 2, { ctrlKey: true }],
    ] as const) {
      Object.defineProperty(element, "setPointerCapture", { value: () => undefined, configurable: true });
      Object.defineProperty(element, "releasePointerCapture", { value: () => undefined, configurable: true });
      fireEvent.pointerDown(element, { button: 0, pointerId, clientX: 10, clientY: 10, ...extra });
      fireEvent.pointerUp(element, { button: 0, pointerId, clientX: 10, clientY: 10 });
    }

    Object.defineProperty(second, "setPointerCapture", { value: () => undefined, configurable: true });
    Object.defineProperty(second, "releasePointerCapture", { value: () => undefined, configurable: true });
    await act(async () => {
      fireEvent.pointerDown(second, { button: 0, pointerId: 3, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(second, { pointerId: 3, clientX: 200, clientY: 10 });
      fireEvent.pointerUp(second, { button: 0, pointerId: 3, clientX: 200, clientY: 10 });
    });

    await waitFor(() => expect(moveStarted).toBe(true));
    expect(view.queryByRole("status")).not.toBeNull();
  } finally {
    release?.();
    document.elementFromPoint = originalElementFromPoint;
    environment.dispose();
  }
});
