import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import type { FileManagerOpenAuthority } from "../../src/os/file-manager/activation.ts";
import type { FileManagerTrashAuthority } from "../../src/os/file-manager/delete.ts";
import { MemoryFsRepository, PersistentFsService } from "../../src/os/fs/index.ts";
import type { FsNode, FsService } from "../../src/os/contracts/index.ts";

const unusedOpenAuthority: FileManagerOpenAuthority = {
  async openNode() {
    throw new Error("File opening is not exercised by the #570 download regression");
  },
};

const unusedTrashAuthority: FileManagerTrashAuthority = {
  async trash() {
    throw new Error("Trash is not exercised by the #570 download regression");
  },
};

afterEach(() => cleanup());

async function directory(fs: FsService, path: string): Promise<FsNode> {
  const node = await fs.resolvePath(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("dismissing a download menu invalidates its delayed preparation", async () => {
  const baseFs = new PersistentFsService(new MemoryFsRepository());
  const documents = await directory(baseFs, "/Documents");
  const file = await baseFs.createFile(documents.id, "Delayed download.txt", { mime: "text/plain" });
  await baseFs.write(file.id, Uint8Array.from([1, 2, 3]), { truncate: true });

  let firstStarted!: () => void;
  const firstReadStarted = new Promise<void>((resolve) => { firstStarted = resolve; });
  let secondStarted!: () => void;
  const secondReadStarted = new Promise<void>((resolve) => { secondStarted = resolve; });
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let releaseSecond!: () => void;
  const secondGate = new Promise<void>((resolve) => { releaseSecond = resolve; });
  let reads = 0;
  const fs = new Proxy(baseFs, {
    get(target, property, receiver) {
      if (property !== "read") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["read"]>) => {
        reads += 1;
        if (reads === 1) {
          firstStarted();
          await firstGate;
        } else if (reads === 2) {
          secondStarted();
          await secondGate;
        }
        return target.read(...args);
      };
    },
  }) as FsService;

  const view = render(
    <FileManager
      directoryId={documents.id}
      fs={fs}
      openAuthority={unusedOpenAuthority}
      trashAuthority={unusedTrashAuthority}
      clipboard={new FileOperationClipboard()}
    />,
  );

  try {
    const entry = await view.findByRole("option", { name: "Delayed download.txt" });
    const root = view.getByRole("listbox", { name: "Files" });
    await act(async () => {
      fireEvent.contextMenu(entry, { button: 2 });
      await firstReadStarted;
    });
    expect(view.getByRole("menu")).toBeDefined();

    await act(async () => {
      fireEvent.keyDown(root, { key: "Escape" });
    });
    await waitFor(() => expect(view.queryByRole("menu")).toBeNull());

    await act(async () => {
      releaseFirst();
      await firstGate;
    });
    expect(reads).toBe(1);

    await act(async () => {
      fireEvent.contextMenu(entry, { button: 2 });
      await secondReadStarted;
    });
    expect(reads).toBe(2);

    await act(async () => {
      releaseSecond();
      await secondGate;
    });
  } finally {
    releaseFirst?.();
    releaseSecond?.();
    view.unmount();
  }
});
