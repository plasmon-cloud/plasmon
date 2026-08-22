import type { FsService } from "../os/contracts/index.ts";
import {
  nodeShortcutSeedSpec,
  reconcileSeedManifest,
  type FilesystemSeedSpec,
} from "../os/fs/index.ts";

export const DEMO_TEXT_PATH = "/Documents/Demo Notes.txt";
export const DEMO_MARKDOWN_PATH = "/Documents/Demo Guide.md";
export const DEMO_IMAGE_PATH = "/Pictures/Demo Artwork.svg";

const DEMO_TEXT = `Plasmon Demo Notes

This document is authored for the Plasmon demo environment.
Use FileManager, Search, Desktop, and Text Editor to discover and open it through normal filesystem associations.
`;

const DEMO_MARKDOWN = `# Plasmon Demo

This redistribution-safe Markdown demo document is authored in the Plasmon repository.

- Open it from Desktop, FileManager, or Search.
- Edit it with the native Markdown application.
- Demo content is selected by the plasmon:demo deployment, not browser URL state.
`;

const DEMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="Plasmon demo artwork">
  <rect width="960" height="540" fill="#121722"/>
  <circle cx="480" cy="270" r="150" fill="#73d6ff" opacity="0.22"/>
  <circle cx="480" cy="270" r="88" fill="#8af0c8" opacity="0.72"/>
  <path d="M188 336 C332 126 628 126 772 336" fill="none" stroke="#f0d27a" stroke-width="18" stroke-linecap="round"/>
  <text x="480" y="458" text-anchor="middle" font-family="system-ui, sans-serif" font-size="42" font-weight="700" fill="#f5f7fb">Plasmon Demo</text>
</svg>`;

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Demo-deployment content expressed only through production filesystem seeds. */
export function createDemoSeeds(): readonly FilesystemSeedSpec[] {
  return [
    {
      key: "demo.documents-directory.v1",
      seedClass: "demo-temporary",
      parentPath: "/",
      name: "Documents",
      kind: "directory",
    },
    {
      key: "demo.pictures-directory.v1",
      seedClass: "demo-temporary",
      parentPath: "/",
      name: "Pictures",
      kind: "directory",
    },
    {
      key: "demo.notes.v1",
      seedClass: "demo-temporary",
      parentPath: "/Documents",
      name: "Demo Notes.txt",
      kind: "file",
      mime: "text/plain",
      bytes: encode(DEMO_TEXT),
    },
    {
      key: "demo.guide.v1",
      seedClass: "demo-temporary",
      parentPath: "/Documents",
      name: "Demo Guide.md",
      kind: "file",
      mime: "text/markdown",
      bytes: encode(DEMO_MARKDOWN),
    },
    {
      key: "demo.artwork.v1",
      seedClass: "demo-temporary",
      parentPath: "/Pictures",
      name: "Demo Artwork.svg",
      kind: "file",
      mime: "image/svg+xml",
      bytes: encode(DEMO_SVG),
    },
  ];
}

const DEMO_DESKTOP_SHORTCUTS = [
  { key: "demo.desktop.notes.v1", name: "Demo Notes.txt", targetPath: DEMO_TEXT_PATH },
  { key: "demo.desktop.guide.v1", name: "Demo Guide.md", targetPath: DEMO_MARKDOWN_PATH },
  { key: "demo.desktop.artwork.v1", name: "Demo Artwork.svg", targetPath: DEMO_IMAGE_PATH },
] as const;

/** Reconcile stable NodeId-backed Desktop shortcuts after demo files exist. */
export async function reconcileDemoDesktopShortcuts(fs: FsService): Promise<void> {
  const specs = (await Promise.all(
    DEMO_DESKTOP_SHORTCUTS.map((shortcut) => nodeShortcutSeedSpec(fs, {
      key: shortcut.key,
      seedClass: "demo-temporary",
      parentPath: "/Desktop",
      name: shortcut.name,
      targetPath: shortcut.targetPath,
    })),
  )).filter((spec): spec is FilesystemSeedSpec => spec !== null);
  await reconcileSeedManifest(fs, specs);
}
