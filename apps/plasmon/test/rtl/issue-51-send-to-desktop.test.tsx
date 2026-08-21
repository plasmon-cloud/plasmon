import { expect, test } from "bun:test";
import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createHeadlessPlasmonEnvironment } from "../headlessEnvironment.ts";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import type { FsNode } from "../../src/os/contracts/index.ts";

async function directory(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>, path: string): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("#51 RED — selected FileManager resources expose Send to Desktop and create a NodeId shortcut", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  const user = userEvent.setup();
  try {
    await environment.ready;
    const documents = await directory(environment, "/Documents");
    const target = await environment.services.fs.createFile(documents.id, "Send Me.txt", { mime: "text/plain" });
    const view = render(
      <FileManager
        directoryId={documents.id}
        fs={environment.services.fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
      />,
    );
    const option = await view.findByRole("option", { name: target.name });
    await user.click(option);
    const send = within(view.getByRole("toolbar", { name: "File commands" })).getByRole("button", { name: /Send to Desktop/u });
    await user.click(send);
    await waitFor(async () => {
      const desktop = await directory(environment, "/Desktop");
      const shortcuts = (await environment.services.fs.list(desktop.id, { includeHidden: true })).filter((node) => node.kind === "shortcut");
      expect(shortcuts.some((shortcut) => shortcut.metadata["plasmon.shortcut"] && JSON.stringify(shortcut.metadata["plasmon.shortcut"]).includes(target.id))).toBe(true);
    });
    view.unmount();
  } finally {
    environment.dispose();
  }
});
