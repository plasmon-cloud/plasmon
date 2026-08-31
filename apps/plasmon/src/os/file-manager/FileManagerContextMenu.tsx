import {
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { FsNode, NodeId } from "../contracts/index.ts";
import { fitContextMenuPosition } from "./context-menu-position.ts";

export type FileManagerContextMenuAction =
  | "open"
  | "openWith"
  | "download"
  | "cut"
  | "copy"
  | "createShortcut"
  | "sendToDesktop"
  | "rename"
  | "delete"
  | "properties"
  | "newFolder"
  | "newText"
  | "newMarkdown"
  | "import"
  | "paste"
  | "personalize";

export interface FileManagerContextMenuState {
  x: number;
  y: number;
  nodeId: NodeId | null;
}

interface FileManagerContextMenuProps {
  state: FileManagerContextMenuState;
  node: FsNode | null;
  canOpenWith: boolean;
  canDownload: boolean;
  canCreateShortcut: boolean;
  operationRunning: boolean;
  canPaste: boolean;
  showPersonalize: boolean;
  onAction: (action: FileManagerContextMenuAction) => void;
}

export function shouldShowPersonalizeMenuItem(node: FsNode | null, enabled: boolean): boolean {
  return node === null && enabled;
}

export function FileManagerContextMenu(props: FileManagerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const showPersonalize = shouldShowPersonalizeMenuItem(props.node, props.showPersonalize);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const boundary = menu?.parentElement;
    if (!menu || !boundary) return;

    const menuRect = menu.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const position = fitContextMenuPosition(
      { x: props.state.x, y: props.state.y },
      { width: menuRect.width, height: menuRect.height },
      {
        left: boundaryRect.left,
        top: boundaryRect.top,
        right: boundaryRect.right,
        bottom: boundaryRect.bottom,
      },
    );
    menu.style.left = `${position.x}px`;
    menu.style.top = `${position.y}px`;
  });

  return (
    <div
      ref={menuRef}
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
            <button
              type="button"
              role="menuitem"
              disabled={!props.canDownload}
              title={props.canDownload ? undefined : "Preparing download"}
              onClick={() => props.onAction("download")}
            >
              Download
            </button>
          ) : null}
          <div className="fm-menu-separator" role="separator" />
          <button type="button" role="menuitem" onClick={() => props.onAction("cut")}>Cut</button>
          <button type="button" role="menuitem" onClick={() => props.onAction("copy")}>Copy</button>
          <button type="button" role="menuitem" disabled={!props.canCreateShortcut} onClick={() => props.onAction("createShortcut")}>Create Shortcut</button>
          <button type="button" role="menuitem" disabled={!props.canCreateShortcut} onClick={() => props.onAction("sendToDesktop")}>Send to Desktop (create shortcut)</button>
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
          {showPersonalize ? (
            <>
              <div className="fm-menu-separator" role="separator" />
              <button type="button" role="menuitem" onClick={() => props.onAction("personalize")}>Personalize</button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
