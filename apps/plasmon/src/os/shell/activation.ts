import type { FsNode, HandlerId, OpenTarget } from "../contracts/index.ts";
import {
  executeOpenResourceCommand,
  openResourceCommand,
  type ResourceOpenCommandAuthority,
} from "../resource-command.ts";
import type { ShellSearchResult } from "./search.ts";

/** Canonical filesystem opening seam consumed by Shell presentation adapters. */
export interface ShellFilesystemOpener extends ResourceOpenCommandAuthority {}

export type FilesystemSearchResult = Extract<ShellSearchResult, { node: FsNode }>;

export interface ShellApplicationOpener {
  open(handlerId: HandlerId, target: OpenTarget): Promise<unknown>;
}

export const SHELL_SETTINGS_HANDLER_ID: HandlerId = "native:settings";

/** Shell Settings is an application command, so it opens the canonical app without content. */
export async function activateShellSettings(opener: ShellApplicationOpener): Promise<void> {
  const result = await opener.open(SHELL_SETTINGS_HANDLER_ID, {});
  if (result === null) throw new Error("Settings is not registered with the native process runtime");
}

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