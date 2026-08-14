import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import type { FileManagerOpenAuthority } from "../../src/os/file-manager/activation.ts";
import type { FileManagerTrashAuthority } from "../../src/os/file-manager/delete.ts";
import { MemoryFsRepository, PersistentFsService } from "../../src/os/fs/index.ts";
import type { FsNode, FsService } from "../../src/os/contracts/index.ts";

const unusedOpenAuthority: FileManagerOpenAuthority = {
  async openNode() {
    throw new Error("File opening is not exercised by the #65 progress regression");
  },
};

const unusedTrashAuthority: FileManagerTrashAuthority = {
  async trash() {
    throw new Error("Trash is not exercised by the #65 progress regression");
  },
};

afterEach(() => cleanup());

function operationFs(): FsService {
  return new PersistentFsService(new MemoryFsRepository());
}

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

async function directory(fs: FsService, path: string): Promise<FsNode> {
  const node = await fs.resolvePath(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("#65 RED — multi-file import exposes truthful accessible running state while writes are pending", async () => {
  const baseFs = operationFs();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let writeStarted = false;
  try {
    const documents = await directory(baseFs, "/Documents");
    const fs = delayedWrites(baseFs, () => { writeStarted = true; }, gate);
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={new FileOperationClipboard()}
      />,
    );
    await waitFor(() => expect(view.getByRole("button", { name: "Import Files…" })).toBeDefined());
    const input = view.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("FileManager import input is unavailable");
    const file = new File([new Uint8Array([1, 2, 3])], "large.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(writeStarted).toBe(true));
    expect(view.queryByRole("status")).not.toBeNull();
    release();
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
  } finally {
    release?.();
  }
});

test("#65 paste exposes truthful running state while the filesystem copy is pending", async () => {
  const baseFs = operationFs();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let copyStarted = false;
  try {
    const documents = await directory(baseFs, "/Documents");
    const desktop = await directory(baseFs, "/Desktop");
    const source = await baseFs.createFile(documents.id, "source.txt", { mime: "text/plain" });
    const clipboard = new FileOperationClipboard();
    clipboard.copy([source.id]);
    const fs = delayedCopies(baseFs, () => { copyStarted = true; }, gate);
    const view = render(
      <FileManager
        directoryId={desktop.id}
        fs={fs}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={clipboard}
      />,
    );
    const pasteButton = await waitFor(() => view.getByRole("button", { name: "Paste" }));
    fireEvent.click(pasteButton);
    await waitFor(() => expect(copyStarted).toBe(true));
    expect(view.getByRole("status").textContent).toContain("Pasting 1 item");
    release();
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
  } finally {
    release?.();
  }
});
