import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import {
  APPS_PATH,
  readNeutronAppMetadata,
  readSharedShortcut,
  readSystemAppMetadata,
} from "../fs/index.ts";
import {
  composeShortcutPresentation,
  type FileTypeIconName,
  type ResourceIconPresentation,
} from "../visual/index.ts";

export type FileVisualKind = "folder" | "text" | "markdown" | "image" | "video" | "shortcut" | "atom" | "unknown";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogv", ".avi", ".mkv"]);
const SOURCE_EXTENSIONS = new Set([
  ".txt", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".html", ".htm",
  ".xml", ".yaml", ".yml", ".toml", ".rs", ".py", ".go", ".java", ".c", ".h", ".cpp",
  ".sh", ".sql", ".ini", ".conf", ".log",
]);

const SHARED_FILE_ICON: Readonly<Record<FileVisualKind, FileTypeIconName>> = Object.freeze({
  folder: "folder",
  text: "text",
  markdown: "markdown",
  image: "image",
  video: "video",
  shortcut: "file",
  atom: "atom",
  unknown: "file",
});

const SHARED_NATIVE_PRESENTATION: Readonly<Record<string, ResourceIconPresentation>> = Object.freeze({
  "native:explorer": { kind: "system", icon: "file-manager" },
  "native:settings": { kind: "system", icon: "settings" },
  "native:photos": { kind: "system", icon: "photos" },
  "native:browser": { kind: "system", icon: "browser" },
  "native:properties": { kind: "system", icon: "properties" },
  "native:start": { kind: "system", icon: "start" },
  "native:search": { kind: "system", icon: "search" },
  "native:recycle-bin": { kind: "system", icon: "recycle-bin" },
  "native:text": { kind: "file-type", icon: "text" },
  "native:markdown": { kind: "file-type", icon: "markdown" },
  "native:video": { kind: "file-type", icon: "video" },
});

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

export function fileVisualKind(node: FsNode): FileVisualKind {
  if (node.kind === "directory") return "folder";
  if (node.kind === "atom" || node.name.toLowerCase().endsWith(".atom")) return "atom";
  if (node.kind === "shortcut" || node.name.toLowerCase().endsWith(".url")) return "shortcut";
  const ext = extension(node.name);
  if (ext === ".md" || ext === ".markdown" || node.mime === "text/markdown") return "markdown";
  if (node.mime?.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) return "image";
  if (node.mime?.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return "video";
  if (node.mime?.startsWith("text/") || SOURCE_EXTENSIONS.has(ext)) return "text";
  return "unknown";
}

/** Maps FileManager's already-resolved ordinary semantic kind onto shared visual artwork. */
export function resourceIconPresentationForFile(node: FsNode): ResourceIconPresentation {
  return { kind: "file-type", icon: SHARED_FILE_ICON[fileVisualKind(node)] };
}

export interface FileResourcePresentation {
  presentation: ResourceIconPresentation;
  shortcut: boolean;
}

function applicationPresentation(src?: string | null): ResourceIconPresentation {
  return { kind: "application", src: src ?? null };
}

function nativeApplicationPresentation(
  handlerId: string,
  associations?: AssociationRegistry,
): ResourceIconPresentation {
  const registeredIcon = associations?.getHandler(handlerId)?.icon;
  if (registeredIcon) return applicationPresentation(registeredIcon);
  return SHARED_NATIVE_PRESENTATION[handlerId] ?? applicationPresentation();
}

/**
 * Resolve direct resource identity from authoritative filesystem/application metadata.
 * Association lookup is metadata-only here: no matching, default selection, or opening occurs.
 */
export function directFileResourcePresentation(
  node: FsNode,
  associations?: AssociationRegistry,
): ResourceIconPresentation {
  const systemApp = readSystemAppMetadata(node);
  if (systemApp) return nativeApplicationPresentation(systemApp.handlerId, associations);

  const neutronApp = readNeutronAppMetadata(node);
  if (neutronApp) return applicationPresentation(neutronApp.icon);

  return resourceIconPresentationForFile(node);
}

/** Safe synchronous presentation used immediately and whenever richer target lookup fails. */
export function fallbackFileResourcePresentation(
  node: FsNode,
  associations?: AssociationRegistry,
): FileResourcePresentation {
  const direct = directFileResourcePresentation(node, associations);
  if (fileVisualKind(node) !== "shortcut") return { presentation: direct, shortcut: false };
  const composed = composeShortcutPresentation(direct);
  return { presentation: composed.target, shortcut: composed.shortcut };
}

async function neutronElementPresentation(
  fs: FsService,
  elementId: string,
): Promise<ResourceIconPresentation> {
  const apps = await fs.resolvePath(APPS_PATH);
  if (!apps || apps.kind !== "directory") return applicationPresentation();
  const projections = await fs.list(apps.id, { includeHidden: true, sort: "name" });
  const projection = projections.find((candidate) => readNeutronAppMetadata(candidate)?.elementId === elementId);
  return projection ? directFileResourcePresentation(projection) : applicationPresentation();
}

async function shortcutTargetPresentation(
  fs: FsService,
  node: FsNode,
  associations: AssociationRegistry | undefined,
  visited: ReadonlySet<string>,
): Promise<ResourceIconPresentation> {
  const shortcut = readSharedShortcut(node);
  if (!shortcut) return resourceIconPresentationForFile(node);

  try {
    switch (shortcut.target.kind) {
      case "native":
        return nativeApplicationPresentation(shortcut.target.handlerId, associations);
      case "element":
        return await neutronElementPresentation(fs, shortcut.target.elementId);
      case "node": {
        if (visited.has(shortcut.target.nodeId)) return { kind: "file-type", icon: "file" };
        const target = await fs.stat(shortcut.target.nodeId);
        const nextVisited = new Set(visited);
        nextVisited.add(node.id);
        const resolved = await resolveFileResourcePresentation(fs, target, associations, nextVisited);
        return resolved.presentation;
      }
      case "url":
        return { kind: "file-type", icon: "file" };
    }
  } catch {
    if (shortcut.target.kind === "native") return nativeApplicationPresentation(shortcut.target.handlerId, associations);
    if (shortcut.target.kind === "element") return applicationPresentation();
    return { kind: "file-type", icon: "file" };
  }
}

/**
 * FileManager production seam from resource semantics to the shared Visual presentation vocabulary.
 * Shortcut targets are inspected only for presentation metadata; this never dispatches or executes them.
 */
export async function resolveFileResourcePresentation(
  fs: FsService,
  node: FsNode,
  associations?: AssociationRegistry,
  visited: ReadonlySet<string> = new Set(),
): Promise<FileResourcePresentation> {
  if (fileVisualKind(node) !== "shortcut") {
    return { presentation: directFileResourcePresentation(node, associations), shortcut: false };
  }

  if (visited.has(node.id)) return fallbackFileResourcePresentation(node, associations);
  const target = await shortcutTargetPresentation(fs, node, associations, visited);
  const composed = composeShortcutPresentation(target);
  return { presentation: composed.target, shortcut: composed.shortcut };
}
