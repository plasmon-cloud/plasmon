import type { FsNode, NodeId } from "./contracts/index.ts";
import type { OpenFilesystemNodeOptions } from "./fs/index.ts";

/**
 * The smallest shared user-action command currently justified by real consumers.
 * Filesystem opening remains authoritative in FilesystemOpenDispatcher; this seam
 * only normalizes the user intent consumed by FileManager and Shell.
 */
export interface ResourceOpenCommandAuthority {
  openNode(nodeId: NodeId, options?: OpenFilesystemNodeOptions): Promise<void>;
}

export interface OpenResourceCommand {
  readonly kind: "open";
  readonly nodeId: NodeId;
  readonly options?: OpenFilesystemNodeOptions;
}

export type OpenResourceCommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: unknown };

export function openResourceCommand(
  node: Pick<FsNode, "id">,
  options?: OpenFilesystemNodeOptions,
): OpenResourceCommand {
  return options
    ? { kind: "open", nodeId: node.id, options }
    : { kind: "open", nodeId: node.id };
}

export async function runOpenResourceCommand(
  authority: ResourceOpenCommandAuthority,
  command: OpenResourceCommand,
): Promise<OpenResourceCommandResult> {
  try {
    if (command.options) await authority.openNode(command.nodeId, command.options);
    else await authority.openNode(command.nodeId);
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error };
  }
}

/** Preserve existing caller-facing throw semantics while sharing command results. */
export async function executeOpenResourceCommand(
  authority: ResourceOpenCommandAuthority,
  command: OpenResourceCommand,
): Promise<void> {
  const result = await runOpenResourceCommand(authority, command);
  if (!result.ok) throw result.error;
}
