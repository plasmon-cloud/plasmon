import { expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { createHeadlessPlasmonEnvironment } from "../headlessEnvironment.ts";
import { FileManager } from "../../src/os/file-manager/FileManager.tsx";
import { FileOperationClipboard } from "../../src/os/file-manager/model.ts";
import { createShortcut } from "../../src/os/fs/index.ts";
import type { FsNode } from "../../src/os/contracts/index.ts";

async function directory(
  environment: ReturnType<typeof createHeadlessPlasmonEnvironment>,
  path: string,
): Promise<FsNode> {
  const node = await environment.node(path);
  if (!node || node.kind !== "directory") throw new Error(`${path} is unavailable`);
  return node;
}

test("#509 Desktop SVG shortcut renders the target's real thumbnail and keeps the shortcut overlay", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const pictures = await directory(environment, "/Pictures");
    const desktop = await directory(environment, "/Desktop");
    const content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#7c3aed"/></svg>';
    const target = await environment.services.fs.createFile(pictures.id, "Demo Artwork.svg");
    await environment.services.fs.write(target.id, new TextEncoder().encode(content), { truncate: true });
    const shortcut = await createShortcut(
      environment.services.fs,
      desktop.id,
      { kind: "node", nodeId: target.id },
      { name: "Demo Artwork.svg" },
    );

    const view = render(
      <FileManager
        directoryId={desktop.id}
        fs={environment.services.fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
        presentation="desktop"
      />,
    );

    const option = await view.findByRole("option", { name: "Demo Artwork.svg" });
    expect(option.getAttribute("data-fm-node-id")).toBe(shortcut.id);
    expect(option.getAttribute("data-fm-kind")).toBe("shortcut");

    await waitFor(() => {
      const thumbnail = option.querySelector<HTMLImageElement>("img.plasmon-media-thumbnail");
      expect(thumbnail).not.toBeNull();
      const src = thumbnail?.getAttribute("src") ?? "";
      expect(src.startsWith("blob:") || src.startsWith("data:image/svg+xml;base64,")).toBe(true);
      expect(option.querySelector(".plasmon-shortcut-overlay")).not.toBeNull();
    });

    view.unmount();
  } finally {
    environment.dispose();
  }
});
