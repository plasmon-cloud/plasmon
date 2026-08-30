import type { FsNode } from "../contracts/index.ts";
import {
  executeOpenResourceCommand,
  openResourceCommand,
  type ResourceOpenCommandAuthority,
} from "../resource-command.ts";
import type { ShellSearchResult } from "./search.ts";

/** Canonical filesystem opening seam consumed by Shell presentation adapters. */
export interface ShellFilesystemOpener extends ResourceOpenCommandAuthority {}

export type FilesystemSearchResult = Extract<ShellSearchResult, { node: FsNode }>;

/**
 * Start owns folder navigation inside /System/Start Menu, but actual filesystem
 * resource activation runs through the shared resource command and delegates to
 * the canonical filesystem opener.
 */
export async function activateStartFilesystemNode(
  opener: ShellFilesystemOpener,
  node: FsNode,
): Promise<void> {
  await executeOpenResourceCommand(opener, openResourceCommand(node));
}

/** Search owns result selection/presentation, not filesystem resource policy. */
export async function activateSearchFilesystemResult(
  opener: ShellFilesystemOpener,
  result: FilesystemSearchResult,
): Promise<void> {
  await executeOpenResourceCommand(opener, openResourceCommand(result.node));
}
