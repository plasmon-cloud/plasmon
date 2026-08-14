import { expect, test } from "bun:test";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createHeadlessPlasmonEnvironment } from "../headlessEnvironment.ts";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import type { FsNode, FsService } from "../../src/os/contracts/index.ts";

function delayedWrites(fs: FsService, started: () => void, release: Promise<void>): FsService {
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property !== "write") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["write"]>) => {
        started();
        await release;
        return target.write(...args);
      };
    },
  });
}

function delayedCopies(fs: FsService, started: () => void, release: Promise<void>): FsService {
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property !== "copy") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["copy"]>) => {
        started();
        await release;
        return target.copy(...args);
      };
    },
  });
}

async function directory(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>, path: string): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("#65 RED — multi-file import exposes truthful accessible running state while writes are pending", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let writeStarted = false;
  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const fs = delayedWrites(environment.services.fs, () => { writeStarted = true; }, gate);
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
      />,
    );
    await waitFor(() => expect(view.getByRole("button", { name: "Import Files…" })).toBeDefined());
    const input = view.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("FileManager import input is unavailable");
    const file = new File([new Uint8Array([1, 2, 3])], "large.txt", { type: "text/plain" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(writeStarted).toBe(true));
    expect(view.queryByRole("status")).not.toBeNull();
    release();
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
    view.unmount();
  } finally {
    release?.();
    environment.dispose();
  }
});

test("#65 paste exposes truthful running state while the filesystem copy is pending", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let copyStarted = false;
  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const desktop = await directory(environment, "/Desktop");
    const source = await environment.services.fs.createFile(documents.id, "source.txt", { mime: "text/plain" });
    const clipboard = new FileOperationClipboard();
    clipboard.copy([source.id]);
    const fs = delayedCopies(environment.services.fs, () => { copyStarted = true; }, gate);
    const view = render(
      <FileManager
        directoryId={desktop.id}
        fs={fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={clipboard}
      />,
    );
    const pasteButton = await waitFor(() => view.getByRole("button", { name: "Paste" }));
    await act(async () => { fireEvent.click(pasteButton); });
    await waitFor(() => expect(copyStarted).toBe(true));
    expect(view.getByRole("status").textContent).toContain("Pasting 1 item");
    release();
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
    view.unmount();
  } finally {
    release?.();
    environment.dispose();
  }
});
