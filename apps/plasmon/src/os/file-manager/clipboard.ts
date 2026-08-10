import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import { FileOperationClipboard } from "./model.ts";

export function normalizedCollisionName(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

export function splitCopyName(name: string, isDirectory: boolean): { stem: string; extension: string } {
  if (isDirectory) return { stem: name, extension: "" };
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) return { stem: name, extension: "" };
  return { stem: name.slice(0, lastDot), extension: name.slice(lastDot) };
}

export function collisionFreeCopyName(
  originalName: string,
  isDirectory: boolean,
  occupiedNames: ReadonlySet<string>,
): string {
  if (!occupiedNames.has(normalizedCollisionName(originalName))) return originalName;
  const { stem, extension } = splitCopyName(originalName, isDirectory);
  for (let suffix = 1; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidate = `${stem} (${suffix})${extension}`;
    if (!occupiedNames.has(normalizedCollisionName(candidate))) return candidate;
  }
  throw new Error(`Unable to allocate a copy name for ${originalName}`);
}

export async function pasteClipboardCollisionAware(
  fs: FsService,
  destinationId: NodeId,
  clipboard: FileOperationClipboard,
): Promise<readonly FsNode[]> {
  const snapshot = clipboard.snapshot();
  if (!snapshot) return [];

  if (snapshot.mode === "cut") {
    const moved: FsNode[] = [];
    for (const id of snapshot.ids) {
      const result = await fs.move(id, destinationId);
      moved.push(result);
      clipboard.remove([id]);
    }
    return moved;
  }

  const occupied = new Set((await fs.list(destinationId)).map((node) => normalizedCollisionName(node.name)));
  const copied: FsNode[] = [];
  for (const id of snapshot.ids) {
    const source = await fs.stat(id);
    const name = collisionFreeCopyName(source.name, source.kind === "directory", occupied);
    const result = name === source.name
      ? await fs.copy(id, destinationId)
      : await fs.copy(id, destinationId, name);
    copied.push(result);
    occupied.add(normalizedCollisionName(result.name));
    occupied.add(normalizedCollisionName(name));
  }
  return copied;
}
