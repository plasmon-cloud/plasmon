import type { MouseEvent as ReactMouseEvent } from "react";
import type { FsNode, NodeId } from "../contracts/index.ts";

export type FileManagerContextMenuAction =
  | "open"
  | "openWith"
  | "download"
  | "cut"
  | "copy"
  | "createShortcut"
  | "rename"
  | "delete"
  | "properties"
  | "newFolder"
  | "newText"
  | "newMarkdown"
  | "import"
  | "paste";

export interface FileManagerContextMenuState {
  x: number;
  y: number;
  nodeId: NodeId | null;
}

interface FileManagerContextMenuProps {
  state: FileManagerContextMenuState;
  node: FsNode | null;
  canOpenWith: boolean;
  canCreateShortcut: boolean;
  operationRunning: boolean;
  canPaste: boolean;
  onAction: (action: FileManagerContextMenuAction) => void;
}

export function FileManagerContextMenu(props: FileManagerContextMenuProps) {
  return (
    <div
      className="fm-context-menu"
      role="menu"
      style={{ left: props.state.x, top: props.state.y }}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => event.preventDefault()}
    >
      {props.node ? (
        <>
          <button type="button" role="menuitem" onClick={() => props.onAction("open")}>Open</button>
          {props.node.kind !== "directory" ? (
            <button
              type="button"
              role="menuitem"
              disabled={!props.canOpenWith}
              title={props.canOpenWith ? undefined : "Association service unavailable"}
              onClick={() => props.onAction("openWith")}
            >
              Open With…
            </button>
          ) : null}
          {props.node.kind === "file" ? (
            <button type="button" role="menuitem" onClick={() => props.onAction("download")}>Download</button>
          ) : null}
          <div className="fm-menu-separator" role="separator" />
          <button type="button" role="menuitem" onClick={() => props.onAction("cut")}>Cut</button>
          <button type="button" role="menuitem" onClick={() => props.onAction("copy")}>Copy</button>
          <button type="button" role="menuitem" disabled={!props.canCreateShortcut} onClick={() => props.onAction("createShortcut")}>Create Shortcut</button>
          <button type="button" role="menuitem" onClick={() => props.onAction("rename")}>Rename</button>
          <button type="button" role="menuitem" onClick={() => props.onAction("delete")}>Delete</button>
          <div className="fm-menu-separator" role="separator" />
          <button type="button" role="menuitem" onClick={() => props.onAction("properties")}>Properties</button>
        </>
      ) : (
        <>
          <button type="button" role="menuitem" onClick={() => props.onAction("newFolder")}>New Folder</button>
          <button type="button" role="menuitem" onClick={() => props.onAction("newText")}>New Text Document</button>
          <button type="button" role="menuitem" onClick={() => props.onAction("newMarkdown")}>New Markdown Document</button>
          <button type="button" role="menuitem" disabled={props.operationRunning} onClick={() => props.onAction("import")}>Import Files…</button>
          <div className="fm-menu-separator" role="separator" />
          <button type="button" role="menuitem" disabled={props.operationRunning || !props.canPaste} onClick={() => props.onAction("paste")}>Paste</button>
        </>
      )}
    </div>
  );
}
