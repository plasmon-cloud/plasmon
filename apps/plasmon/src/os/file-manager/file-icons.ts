import type { FsNode } from "../contracts/index.ts";
import type { FileTypeIconName, ResourceIconPresentation } from "../visual/index.ts";

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

/** Maps FileManager's already-resolved semantic kind onto shared visual artwork. */
export function resourceIconPresentationForFile(node: FsNode): ResourceIconPresentation {
  return { kind: "file-type", icon: SHARED_FILE_ICON[fileVisualKind(node)] };
}

export function iconForFile(node: FsNode): string {
  switch (fileVisualKind(node)) {
    case "folder": return "▰";
    case "text": return "≡";
    case "markdown": return "M↓";
    case "image": return "▧";
    case "video": return "▶";
    case "shortcut": return "↗";
    case "atom": return "◈";
    default: return "◇";
  }
}
