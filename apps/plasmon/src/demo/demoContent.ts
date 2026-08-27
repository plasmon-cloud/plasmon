import type { FsService } from "../os/contracts/index.ts";
import {
  nodeShortcutSeedSpec,
  reconcileSeedManifest,
  type FilesystemSeedSpec,
} from "../os/fs/index.ts";

export const DEMO_TEXT_PATH = "/Documents/Demo Notes.txt";
export const DEMO_MARKDOWN_PATH = "/Documents/Demo Guide.md";
export const DEMO_IMAGE_PATH = "/Pictures/Demo Artwork.svg";

export interface DemoAssetContent {
  text: string;
  markdown: string;
  svg: string;
}

function packagedDemoContent(): DemoAssetContent {
  // @ts-expect-error Build-time esbuild define; unbundled tests supply explicit asset content.
  const text: string | undefined = typeof __PLASMON_DEMO_TEXT__ === "undefined" ? undefined : __PLASMON_DEMO_TEXT__;
  // @ts-expect-error Build-time esbuild define; unbundled tests supply explicit asset content.
  const markdown: string | undefined = typeof __PLASMON_DEMO_MARKDOWN__ === "undefined" ? undefined : __PLASMON_DEMO_MARKDOWN__;
  // @ts-expect-error Build-time esbuild define; unbundled tests supply explicit asset content.
  const svg: string | undefined = typeof __PLASMON_DEMO_SVG__ === "undefined" ? undefined : __PLASMON_DEMO_SVG__;
  if (text === undefined || markdown === undefined || svg === undefined) {
    throw new Error("Demo content is available only in the packaged plasmon:demo profile");
  }
  return { text, markdown, svg };
}

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Demo-deployment content expressed only through production filesystem seeds. */
export function createDemoSeeds(content: DemoAssetContent = packagedDemoContent()): readonly FilesystemSeedSpec[] {
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
      bytes: encode(content.text),
    },
    {
      key: "demo.guide.v1",
      seedClass: "demo-temporary",
      parentPath: "/Documents",
      name: "Demo Guide.md",
      kind: "file",
      mime: "text/markdown",
      bytes: encode(content.markdown),
    },
    {
      key: "demo.artwork.v1",
      seedClass: "demo-temporary",
      parentPath: "/Pictures",
      name: "Demo Artwork.svg",
      kind: "file",
      mime: "image/svg+xml",
      bytes: encode(content.svg),
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
