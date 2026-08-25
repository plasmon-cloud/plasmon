import type { FsNode, FsService } from "../contracts/index.ts";
import { isShortcutTargetVisibleByDefault } from "./resourceVisibility.ts";
import { parseStartShortcut } from "./startMenu.ts";

/**
 * Presentation-only Start listing for the ordinary hidden-resource policy.
 * Reconciliation and underlying shortcuts remain untouched; only canonical
 * hidden targets are omitted from the rendered Start inventory.
 */
export async function listVisibleStartMenuFolder(fs: FsService, folderId: string): Promise<FsNode[]> {
  const folder = await fs.stat(folderId);
  if (folder.kind !== "directory") throw new Error(`${folder.name} is not a Start Menu folder`);
  const nodes = await fs.list(folder.id, { includeHidden: false, sort: "name" });
  const visible = await Promise.all(nodes.map(async (node) => {
    const shortcut = parseStartShortcut(node);
    return !shortcut || isShortcutTargetVisibleByDefault(fs, shortcut.target);
  }));
  return nodes.filter((_node, index) => visible[index]);
}
