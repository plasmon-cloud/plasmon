import type { FsNode } from "../contracts/index.ts";
import type { OpenFilesystemNodeOptions } from "../fs/index.ts";
import {
  executeOpenResourceCommand,
  openResourceCommand,
  type ResourceOpenCommandAuthority,
} from "../resource-command.ts";

/** Public opening authority consumed by FileManager without owning resource semantics. */
export interface FileManagerOpenAuthority extends ResourceOpenCommandAuthority {}

export interface FileManagerActivationOptions {
  onOpenDirectory?: (node: FsNode) => void | Promise<void>;
}

/**
 * FileManager owns same-window directory presentation, while the shared resource
 * command owns user-action orchestration and the filesystem dispatcher remains
 * authoritative for resource classification, shortcuts, handlers, and opening.
 */
export function activateFileManagerNode(
  authority: FileManagerOpenAuthority,
  node: FsNode,
  options: FileManagerActivationOptions = {},
): Promise<void> {
  const openOptions: OpenFilesystemNodeOptions | undefined = options.onOpenDirectory
    ? { onOpenDirectory: options.onOpenDirectory }
    : undefined;
  return executeOpenResourceCommand(
    authority,
    openResourceCommand(node, openOptions),
  );
}
