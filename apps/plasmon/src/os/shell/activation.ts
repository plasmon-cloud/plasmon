import type { FsNode, NodeId } from "../contracts/index.ts";
import type { ShellSearchResult } from "./search.ts";

/** Canonical filesystem opening seam consumed by Shell presentation adapters. */
export interface ShellFilesystemOpener {
  openNode(nodeId: NodeId): Promise<void>;
}

export type FilesystemSearchResult = Extract<ShellSearchResult, { node: FsNode }>;

/**
 * Start owns folder navigation inside /System/Start Menu, but any actual
 * filesystem resource activation delegates to the canonical filesystem opener.
 */
export async function activateStartFilesystemNode(
  opener: ShellFilesystemOpener,
  node: FsNode,
): Promise<void> {
  await opener.openNode(node.id);
}

/** Search owns result selection/presentation, not filesystem resource policy. */
export async function activateSearchFilesystemResult(
  opener: ShellFilesystemOpener,
  result: FilesystemSearchResult,
): Promise<void> {
  await opener.openNode(result.node.id);
}
