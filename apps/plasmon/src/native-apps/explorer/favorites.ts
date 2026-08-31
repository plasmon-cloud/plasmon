import type { FsEvent, FsNode, FsService, NodeId } from "../../os/contracts/index.ts";
import { APPS_PATH } from "../../os/fs/index.ts";

const DEFAULT_FAVORITE_EXCLUDED_PATHS = ["/Downloads", "/System"] as const;

export interface ExplorerFavoritesSnapshot {
  rootId: NodeId;
  appsId: NodeId | null;
  nodes: FsNode[];
}

/**
 * Default Favorites are a projection of the filesystem root, not an independent
 * folder registry. Intentional non-favorite roots and the canonical Apps root
 * are resolved through FsService so every returned favorite keeps its real
 * filesystem NodeId.
 */
export async function readDefaultExplorerFavorites(fs: FsService): Promise<ExplorerFavoritesSnapshot> {
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");

  const [apps, ...excluded] = await Promise.all([
    fs.resolvePath(APPS_PATH),
    ...DEFAULT_FAVORITE_EXCLUDED_PATHS.map((path) => fs.resolvePath(path)),
  ]);
  const excludedIds = new Set(
    excluded.filter((node): node is FsNode => Boolean(node)).map((node) => node.id),
  );
  const nodes = (await fs.list(root.id, { sort: "name" }))
    .filter((node) => node.kind === "directory" && !excludedIds.has(node.id));
  const appsId = apps?.kind === "directory" && apps.parentId === root.id ? apps.id : null;

  return { rootId: root.id, appsId, nodes };
}

/** Limits Explorer refresh work to events that can change the root projection. */
export function explorerFavoritesAffectedByEvent(event: FsEvent, rootId: NodeId): boolean {
  if (event.type === "reset") return true;
  if (event.type === "removed") return event.parentId === rootId;
  if (event.type === "moved") return event.oldParentId === rootId || event.node.parentId === rootId;
  return event.node.parentId === rootId;
}
