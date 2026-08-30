import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { DiagnosticRecord } from "../../src/os/diagnostics/index.ts";
import { PlasmonDiagnosticService } from "../../src/os/diagnostics/index.ts";
import type { FsNode, FsService } from "../../src/os/contracts/index.ts";
import type { FileManagerOpenAuthority } from "../../src/os/file-manager/activation.ts";
import type { FileManagerTrashAuthority } from "../../src/os/file-manager/delete.ts";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import { FileOperationState } from "../../src/os/file-manager/operation-state.ts";
import { MemoryFsRepository, PersistentFsService } from "../../src/os/fs/index.ts";

const unusedOpenAuthority: FileManagerOpenAuthority = {
  async openNode() {
    throw new Error("File opening is not exercised by diagnostics tests");
  },
};

const unusedTrashAuthority: FileManagerTrashAuthority = {
  async trash() {
    throw new Error("Trash is not exercised by these diagnostics tests");
  },
};

afterEach(() => cleanup());

function operationFs(): FsService {
  return new PersistentFsService(new MemoryFsRepository());
}

async function directory(fs: FsService, path: string): Promise<FsNode> {
  const node = await fs.resolvePath(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

function diagnosticsFor(fs: FsService): {
  diagnostics: PlasmonDiagnosticService;
  records: DiagnosticRecord[];
  stop: () => void;
} {
  const diagnostics = new PlasmonDiagnosticService({
    fs,
    ready: async () => undefined,
    console: null,
    onSinkError: () => undefined,
  });
  const records: DiagnosticRecord[] = [];
  const stop = diagnostics.subscribe((record) => records.push(record));
  return { diagnostics, records, stop };
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

function fakeFile(name: string, size: number): File {
  return {
    name,
    type: "text/plain",
    size,
    slice() {
      return {
        async arrayBuffer() {
          return new ArrayBuffer(0);
        },
      };
    },
  } as unknown as File;
}

test("move partial failure emits one bounded diagnostic and no lifecycle noise", async () => {
  const fs = operationFs();
  const documents = await directory(fs, "/Documents");
  const operationState = new FileOperationState();
  const { diagnostics, records, stop } = diagnosticsFor(fs);

  try {
    render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        diagnostics={diagnostics}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={new FileOperationClipboard()}
        operationState={operationState}
      />,
    );

    await act(async () => {
      operationState.begin("move", 2);
      operationState.startItem(1, "PRIVATE-first.txt");
      operationState.succeedItem();
      operationState.startItem(2, "PRIVATE-second.txt");
      operationState.failItem("PRIVATE-second.txt", "SECRET move detail");
      operationState.complete();
    });

    const event = records.find((record) => record.event === "filemanager.move.partial");
    expect(event?.context).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(JSON.stringify(event)).not.toContain("PRIVATE-");
    expect(JSON.stringify(event)).not.toContain("SECRET move detail");
    expect(records.some((record) => /\.(?:started|completed)$/u.test(record.event))).toBe(false);
  } finally {
    stop();
  }
});

test("import partial failure logs counts without filename or error text", async () => {
  const fs = operationFs();
  const documents = await directory(fs, "/Documents");
  const operationState = new FileOperationState();
  const terminal = terminalTransition(operationState);
  const { diagnostics, records, stop } = diagnosticsFor(fs);

  try {
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        diagnostics={diagnostics}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={new FileOperationClipboard()}
        operationState={operationState}
      />,
    );
    const input = view.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("FileManager import input is unavailable");

    fireEvent.change(input, {
      target: {
        files: [
          fakeFile("good.txt", 0),
          fakeFile("PRIVATE-import-name.txt", -1),
        ],
      },
    });
    await act(async () => { await terminal; });

    const event = records.find((record) => record.event === "filemanager.import.partial");
    expect(event?.context).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(JSON.stringify(event)).not.toContain("PRIVATE-import-name.txt");
    expect(records.some((record) => /\.(?:started|completed)$/u.test(record.event))).toBe(false);
  } finally {
    stop();
  }
});

test("paste failure logs error type without private error message", async () => {
  const baseFs = operationFs();
  const documents = await directory(baseFs, "/Documents");
  const desktop = await directory(baseFs, "/Desktop");
  const source = await baseFs.createFile(documents.id, "PRIVATE-source.txt", { mime: "text/plain" });
  const clipboard = new FileOperationClipboard();
  clipboard.copy([source.id]);
  const fs = new Proxy(baseFs, {
    get(target, property, receiver) {
      if (property !== "copy") return Reflect.get(target, property, receiver);
      return async () => {
        throw new TypeError("SECRET paste failure for PRIVATE-source.txt");
      };
    },
  });
  const operationState = new FileOperationState();
  const terminal = terminalTransition(operationState);
  const { diagnostics, records, stop } = diagnosticsFor(fs);

  try {
    const view = render(
      <FileManager
        directoryId={desktop.id}
        fs={fs}
        diagnostics={diagnostics}
        openAuthority={unusedOpenAuthority}
        trashAuthority={unusedTrashAuthority}
        clipboard={clipboard}
        operationState={operationState}
      />,
    );

    fireEvent.click(view.getByRole("button", { name: "Paste" }));
    await act(async () => { await terminal; });

    const event = records.find((record) => record.event === "filemanager.paste.failed");
    expect(event?.context).toEqual({ mode: "copy", total: 1, errorType: "TypeError" });
    expect(JSON.stringify(event)).not.toContain("SECRET paste failure");
    expect(JSON.stringify(event)).not.toContain("PRIVATE-source.txt");
  } finally {
    stop();
  }
});

test("delete partial failure logs aggregate counts without item identity", async () => {
  const fs = operationFs();
  const documents = await directory(fs, "/Documents");
  await fs.createFile(documents.id, "PRIVATE-delete-one.txt", { mime: "text/plain" });
  await fs.createFile(documents.id, "PRIVATE-delete-two.txt", { mime: "text/plain" });
  let calls = 0;
  const trashAuthority: FileManagerTrashAuthority = {
    async trash() {
      calls += 1;
      if (calls === 2) throw new TypeError("SECRET delete failure for PRIVATE-delete-two.txt");
    },
  };
  const { diagnostics, records, stop } = diagnosticsFor(fs);

  try {
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={fs}
        diagnostics={diagnostics}
        openAuthority={unusedOpenAuthority}
        trashAuthority={trashAuthority}
        clipboard={new FileOperationClipboard()}
      />,
    );

    const listbox = view.getByRole("listbox", { name: "Files" });
    listbox.focus();
    fireEvent.keyDown(listbox, { key: "a", ctrlKey: true });
    fireEvent.click(view.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(records.some((record) => record.event === "filemanager.delete.partial")).toBe(true);
    });
    const event = records.find((record) => record.event === "filemanager.delete.partial");
    expect(event?.context).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(JSON.stringify(event)).not.toContain("PRIVATE-delete");
    expect(JSON.stringify(event)).not.toContain("SECRET delete failure");
  } finally {
    stop();
  }
});
