import type { FsService } from "../../os/contracts/index.ts";
import type { ExplorerLocation } from "./history.ts";

export async function resolveExplorerAddress(
  fs: FsService,
  value: string,
): Promise<ExplorerLocation> {
  const requested = value.trim() || "/";
  const node = await fs.resolvePath(requested);
  if (!node) throw new Error(`Folder not found: ${requested}`);
  if (node.kind !== "directory") throw new Error(`Not a folder: ${requested}`);
  return { nodeId: node.id, path: await fs.pathOf(node.id) };
}
