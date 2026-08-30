import type { FsNode, FsService } from "../contracts/index.ts";
import {
  isShortcutTargetEligibleForHiddenVisibility,
  readHiddenVisibilityPreferences,
} from "../hiddenVisibility.ts";
import { parseStartShortcut } from "./startMenu.ts";

/**
 * Presentation-only Start listing. Managed Start reconciliation remains
 * untouched; hidden shortcuts stay in filesystem authority and are filtered
 * only when their canonical target is not eligible under the global policy.
 */
export async function listVisibleStartMenuFolder(fs: FsService, folderId: string): Promise<FsNode[]> {
  const folder = await fs.stat(folderId);
  if (folder.kind !== "directory") throw new Error(`${folder.name} is not a Start Menu folder`);
  const { alwaysShowHiddenFiles } = await readHiddenVisibilityPreferences(fs);
  const nodes = await fs.list(folder.id, { includeHidden: alwaysShowHiddenFiles, sort: "name" });
  const eligible = await Promise.all(nodes.map(async (node) => {
    const shortcut = parseStartShortcut(node);
    if (!shortcut) return true;
    return isShortcutTargetEligibleForHiddenVisibility(fs, shortcut.target, alwaysShowHiddenFiles);
  }));
  return nodes.filter((_node, index) => eligible[index]);
}
