import { expect, test } from "bun:test";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { FileManager } from "../../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../../src/os/file-manager/model.ts";
import type { FsNode, FsService } from "../../../src/os/contracts/index.ts";

function delayedWrites(fs: FsService, started: (name: string) => void, release: Promise<void>, failName?: string): FsService {
  return new Proxy(fs, {
    get(target, property, receiver) {
      if (property !== "write") return Reflect.get(target, property, receiver);
      return async (...args: Parameters<FsService["write"]>) => {
        const current = await target.stat(args[0] as string);
        started(current.name);
        await release;
        if (failName && current.name === failName) throw new Error(`write failed for ${failName}`);
        return target.write(...args);
      };
    },
  });
}

async function directory(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>, path: string): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

function renderManager(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>, fs: FsService, clipboard = new FileOperationClipboard()) {
  const documents = environment.node("/Documents");
  return { documents, clipboard, render: async () => render(
    <FileManager
      directoryId={(await documents)!.id}
      fs={fs}
      openAuthority={environment.services.filesystem.open}
      trashAuthority={environment.services.filesystem.trash}
      clipboard={clipboard}
    />,
  ) };
}

test("#65 RED — multi-file import exposes item progress and clears status deterministically", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started: string[] = [];
  let view: ReturnType<typeof render> | undefined;
  try {
    await environment.ready;
    const fs = delayedWrites(environment.services.fs, (name) => started.push(name), gate);
    const manager = renderManager(environment, fs);
    view = await manager.render();
    const input = view.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("FileManager import input is unavailable");
    const files = [
      new File([new Uint8Array([1, 2, 3])], "first.txt", { type: "text/plain" }),
      new File([new Uint8Array([4, 5, 6])], "second.txt", { type: "text/plain" }),
    ];
    await act(async () => { fireEvent.change(input, { target: { files } }); });
    await waitFor(() => expect(started).toEqual(["first.txt"]));
    expect(view.getByRole("status").textContent ?? "").toContain("Importing 1 of 2: first.txt");
    release();
    await waitFor(() => expect(started).toEqual(["first.txt", "second.txt"]));
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
    expect(await environment.node("/Documents/first.txt")).not.toBeNull();
    expect(await environment.node("/Documents/second.txt")).not.toBeNull();
  } finally {
    view?.unmount();
    release?.();
    environment.dispose();
  }
});

test("#65 RED — partial import remains actionable and a conflicting trigger cannot start another operation", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started: string[] = [];
  let view: ReturnType<typeof render> | undefined;
  try {
    await environment.ready;
    const fs = delayedWrites(environment.services.fs, (name) => started.push(name), gate, "bad.txt");
    view = await renderManager(environment, fs).render();
    const input = view.container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("FileManager import input is unavailable");
    const files = [
      new File([new Uint8Array([1])], "good.txt", { type: "text/plain" }),
      new File([new Uint8Array([2])], "bad.txt", { type: "text/plain" }),
    ];
    await act(async () => { fireEvent.change(input, { target: { files } }); });
    await waitFor(() => expect(started).toEqual(["good.txt"]));
    await act(async () => { fireEvent.change(input, { target: { files: [new File([3], "duplicate.txt")] } }); });
    release();
    await waitFor(() => expect(started).toEqual(["good.txt", "bad.txt"]));
    await waitFor(() => expect(view.getByRole("alert").textContent ?? "").toContain("Import failed"));
    expect(await environment.node("/Documents/good.txt")).not.toBeNull();
    expect(await environment.node("/Documents/bad.txt")).toBeNull();
    expect(await environment.node("/Documents/duplicate.txt")).toBeNull();
    expect(view.queryByRole("status")).toBeNull();
  } finally {
    view?.unmount();
    release?.();
    environment.dispose();
  }
});

test("#65 RED — paste uses the same running operation vocabulary without byte-progress claims", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let view: ReturnType<typeof render> | undefined;
  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const source = await environment.services.fs.createFile(documents.id, "paste-source.txt", { mime: "text/plain" });
    const clipboard = new FileOperationClipboard();
    clipboard.copy([source.id]);
    const fs = new Proxy(environment.services.fs, {
      get(target, property, receiver) {
        if (property !== "copy") return Reflect.get(target, property, receiver);
        return async (...args: Parameters<FsService["copy"]>) => { await gate; return target.copy(...args); };
      },
    });
    view = await renderManager(environment, fs, clipboard).render();
    await act(async () => { view.getByRole("button", { name: "Paste" }).click(); });
    await waitFor(() => expect(view.getByRole("status").textContent ?? "").toContain("Pasting 1 item"));
    release();
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
  } finally {
    view?.unmount();
    release?.();
    environment.dispose();
  }
});
