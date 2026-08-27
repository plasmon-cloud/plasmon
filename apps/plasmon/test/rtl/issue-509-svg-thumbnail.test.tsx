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

function expectSvgThumbnail(option: HTMLElement): void {
  const thumbnail = option.querySelector<HTMLImageElement>("img.plasmon-media-thumbnail");
  expect(thumbnail).not.toBeNull();
  const src = thumbnail?.getAttribute("src") ?? "";
  expect(src.startsWith("blob:") || src.startsWith("data:image/svg+xml;base64,")).toBe(true);
}

test("#509 the same SVG thumbnails directly in Pictures and through its Desktop shortcut", async () => {
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

    // Canonical r2 baseline from manual acceptance: the real SVG already
    // thumbnails correctly when viewed directly in Pictures.
    const picturesView = render(
      <FileManager
        directoryId={pictures.id}
        fs={environment.services.fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
        presentation="grid"
      />,
    );

    const directOption = await picturesView.findByRole("option", { name: "Demo Artwork.svg" });
    expect(directOption.getAttribute("data-fm-node-id")).toBe(target.id);
    await waitFor(() => expectSvgThumbnail(directOption));
    expect(directOption.querySelector(".plasmon-shortcut-overlay")).toBeNull();
    picturesView.unmount();

    // The defect was specifically the Desktop NodeId shortcut falling back to
    // generic image artwork instead of borrowing the already-working target
    // thumbnail. The fixed path must preserve shortcut composition as well.
    const desktopView = render(
      <FileManager
        directoryId={desktop.id}
        fs={environment.services.fs}
        openAuthority={environment.services.filesystem.open}
        trashAuthority={environment.services.filesystem.trash}
        clipboard={new FileOperationClipboard()}
        presentation="desktop"
      />,
    );

    const shortcutOption = await desktopView.findByRole("option", { name: "Demo Artwork.svg" });
    expect(shortcutOption.getAttribute("data-fm-node-id")).toBe(shortcut.id);
    expect(shortcutOption.getAttribute("data-fm-kind")).toBe("shortcut");
    await waitFor(() => {
      expectSvgThumbnail(shortcutOption);
      expect(shortcutOption.querySelector(".plasmon-shortcut-overlay")).not.toBeNull();
    });

    desktopView.unmount();
  } finally {
    environment.dispose();
  }
});
