import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import { FileOperationState } from "../../src/os/file-manager/operation-state.ts";
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

function terminalTransition(operationState: FileOperationState): Promise<void> {
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = operationState.subscribe((snapshot) => {
      if (snapshot.status === "completed" || snapshot.status === "failed") {
        unsubscribe();
        resolve();
      }
    });
  });
}

function immediateImportFile(): File {
  const bytes = Uint8Array.from([1, 2, 3]);
  return {
    name: "large.txt",
    type: "text/plain",
    size: bytes.byteLength,
    slice(start = 0, end = bytes.byteLength) {
      const chunk = bytes.slice(start, end);
      return {
        async arrayBuffer() {
          return Uint8Array.from(chunk).buffer;
        },
      };
    },
  } as unknown as File;
}

async function directory(fs: FsService, path: string): Promise<FsNode> {
  const node = await fs.resolvePath(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("RED — multi-file import exposes truthful accessible running state while writes are pending", async () => {
  const baseFs = operationFs();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let signalWriteStarted!: () => void;
  const writeStarted = new Promise<void>((resolve) => { signalWriteStarted = resolve; });
  const operationState = new FileOperationState();
  const terminal = terminalTransition(operationState);

  try {
    const documents = await directory(baseFs, "/Documents");
    const fs = delayedWrites(baseFs, signalWriteStarted, gate);
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={new FileOperationClipboard()}
        operationState={operationState}
      />,
    );
    expect(view.getByRole("button", { name: "Import Files…" })).toBeDefined();
    const input = view.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("FileManager import input is unavailable");

    fireEvent.change(input, { target: { files: [immediateImportFile()] } });
    await writeStarted;
    expect(operationState.snapshot().status).toBe("running");
    expect(view.getByRole("status").textContent).toContain("Importing 1 of 1: large.txt");

    await act(async () => {
      release();
      await terminal;
    });
    expect(operationState.snapshot().status).toBe("completed");
    expect(view.queryByRole("status")).toBeNull();
  } finally {
    release?.();
  }
});

test("paste exposes truthful running state while the filesystem copy is pending", async () => {
  const baseFs = operationFs();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let signalCopyStarted!: () => void;
  const copyStarted = new Promise<void>((resolve) => { signalCopyStarted = resolve; });
  const operationState = new FileOperationState();
  const terminal = terminalTransition(operationState);

  try {
    const documents = await directory(baseFs, "/Documents");
    const desktop = await directory(baseFs, "/Desktop");
    const source = await baseFs.createFile(documents.id, "source.txt", { mime: "text/plain" });
    const clipboard = new FileOperationClipboard();
    clipboard.copy([source.id]);
    const fs = delayedCopies(baseFs, signalCopyStarted, gate);
    const view = render(
      <FileManager
        directoryId={desktop.id}
        fs={fs}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={clipboard}
        operationState={operationState}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Paste" }));
    await copyStarted;
    expect(operationState.snapshot().status).toBe("running");
    expect(view.getByRole("status").textContent).toContain("Pasting 1 item");

    await act(async () => {
      release();
      await terminal;
    });
    expect(operationState.snapshot().status).toBe("completed");
    expect(view.queryByRole("status")).toBeNull();
  } finally {
    release?.();
  }
});
