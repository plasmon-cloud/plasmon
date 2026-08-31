import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { FsNode, NodeId } from "../contracts/index.ts";
import { fitContextMenuPosition } from "./context-menu-position.ts";

export type FileManagerContextMenuAction =
  | "open"
  | "openWith"
  | "download"
  | "runScript"
  | "editScript"
  | "transpileRun"
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
  | "newCmd"
  | "newRun"
  | "import"
  | "paste";

export interface FileManagerContextMenuState {
  x: number;
  y: number;
  nodeId: NodeId | null;
}

export interface FileManagerDesktopWallpaperChoice {
  id: string;
  label: string;
  selected?: boolean;
}

export interface FileManagerDesktopWallpaperMenu {
  choices: readonly FileManagerDesktopWallpaperChoice[];
  disabled?: boolean;
  onSelect: (id: string) => void;
}

interface FileManagerContextMenuProps {
  state: FileManagerContextMenuState;
  node: FsNode | null;
  canOpenWith: boolean;
  canDownload: boolean;
  canTranspileCmd: boolean;
  canRunScript: boolean;
  canEditScript: boolean;
  canCreateShortcut: boolean;
  operationRunning: boolean;
  canPaste: boolean;
  desktopWallpaperMenu?: FileManagerDesktopWallpaperMenu;
  onAction: (action: FileManagerContextMenuAction) => void;
  onDismiss: () => void;
}

const NEW_ITEMS = [
  ["New Folder", "newFolder"],
  ["New Text Document", "newText"],
  ["New Markdown Document", "newMarkdown"],
  ["New Command Script (.cmd)", "newCmd"],
  ["New Run Script (.run)", "newRun"],
] as const;

function Submenu({ id, label, open, disabled, onOpen, children }: {
  id: "new" | "wallpaper";
  label: string;
  open: boolean;
  disabled?: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button role="menuitem" data-fm-background-menuitem="true" data-fm-submenu={id} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onMouseEnter={onOpen} onClick={onOpen}>
        {label} <span aria-hidden="true">›</span>
      </button>
      {open ? <div className="fm-context-menu" role="menu" aria-label={`${label} submenu`} style={{ position: "absolute", left: "calc(100% - 2px)", top: -5 }}>{children}</div> : null}
    </div>
  );
}

function moveFocus(menu: HTMLElement, target: HTMLElement, delta: number, selector: string) {
  const items = Array.from(menu.querySelectorAll<HTMLElement>(selector));
  const index = items.indexOf(target);
  items[(index + delta + items.length) % items.length]?.focus();
}

export function FileManagerContextMenu(props: FileManagerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [submenu, setSubmenu] = useState<"new" | "wallpaper" | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const boundary = menu?.parentElement;
    if (!menu || !boundary) return;
    const menuRect = menu.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const position = fitContextMenuPosition(
      { x: props.state.x, y: props.state.y },
      { width: menuRect.width, height: menuRect.height },
      { left: boundaryRect.left, top: boundaryRect.top, right: boundaryRect.right, bottom: boundaryRect.bottom },
    );
    menu.style.left = `${position.x}px`;
    menu.style.top = `${position.y}px`;
    menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [props.state.nodeId, props.state.x, props.state.y]);

  return (
    <div
      ref={menuRef}
      className="fm-context-menu"
      role="menu"
      aria-label={props.node ? "File context menu" : "Folder background context menu"}
      data-fm-context-menu="true"
      style={{ left: props.state.x, top: props.state.y }}
      onClick={(event) => {
        const action = (event.target as HTMLElement).closest<HTMLElement>("[data-fm-action]")?.dataset.fmAction as FileManagerContextMenuAction | undefined;
        if (action) props.onAction(action);
      }}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        const currentMenu = target.closest<HTMLElement>('[role="menu"]');
        const nested = currentMenu && currentMenu !== menuRef.current;
        if (nested && (event.key === "ArrowLeft" || event.key === "Escape")) {
          event.preventDefault();
          setSubmenu(null);
          (currentMenu.previousElementSibling as HTMLElement | null)?.focus();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          props.onDismiss();
          return;
        }
        const next = target.dataset.fmSubmenu as "new" | "wallpaper" | undefined;
        if (next && (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          setSubmenu(next);
          return;
        }
        if (currentMenu && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          if (!nested) setSubmenu(null);
          moveFocus(currentMenu, target, event.key === "ArrowDown" ? 1 : -1, nested ? ":scope > button:not(:disabled)" : '[data-fm-background-menuitem="true"]:not(:disabled)');
        }
      }}
    >
      {props.node ? (
        <>
          {props.canRunScript ? (
            <>
              <button role="menuitem" data-fm-action="runScript">Run</button>
              <button role="menuitem" data-fm-action="editScript" disabled={!props.canEditScript}>Edit</button>
            </>
          ) : <button role="menuitem" data-fm-action="open">Open</button>}
          {props.node.kind !== "directory" ? <button role="menuitem" data-fm-action="openWith" disabled={!props.canOpenWith} title={props.canOpenWith ? undefined : "Association service unavailable"}>Open With…</button> : null}
          {props.node.kind === "file" ? <button role="menuitem" data-fm-action="download" disabled={!props.canDownload} title={props.canDownload ? undefined : "Preparing download"}>Download</button> : null}
          {props.canTranspileCmd ? <button role="menuitem" data-fm-action="transpileRun">Transpile to .run</button> : null}
          <div className="fm-menu-separator" role="separator" />
          <button role="menuitem" data-fm-action="cut">Cut</button>
          <button role="menuitem" data-fm-action="copy">Copy</button>
          <button role="menuitem" data-fm-action="createShortcut" disabled={!props.canCreateShortcut}>Create Shortcut</button>
          <button role="menuitem" data-fm-action="sendToDesktop" disabled={!props.canCreateShortcut}>Send to Desktop (create shortcut)</button>
          <button role="menuitem" data-fm-action="rename">Rename</button>
          <button role="menuitem" data-fm-action="delete">Delete</button>
          <div className="fm-menu-separator" role="separator" />
          <button role="menuitem" data-fm-action="properties">Properties</button>
        </>
      ) : (
        <>
          <Submenu id="new" label="New" open={submenu === "new"} onOpen={() => setSubmenu("new")}>
            {NEW_ITEMS.map(([label, action], index) => <button key={action} autoFocus={index === 0} role="menuitem" data-fm-action={action}>{label}</button>)}
          </Submenu>
          {props.desktopWallpaperMenu ? (
            <Submenu id="wallpaper" label="Change Wallpaper" open={submenu === "wallpaper"} disabled={props.desktopWallpaperMenu.disabled} onOpen={() => setSubmenu("wallpaper")}>
              {props.desktopWallpaperMenu.choices.map((choice, index) => <button key={choice.id} autoFocus={index === 0} role="menuitemradio" aria-checked={!!choice.selected} onClick={() => { props.desktopWallpaperMenu?.onSelect(choice.id); props.onDismiss(); }}>{choice.label}</button>)}
            </Submenu>
          ) : null}
          <button role="menuitem" data-fm-background-menuitem="true" data-fm-action="import" disabled={props.operationRunning} onMouseEnter={() => setSubmenu(null)}>Import Files…</button>
          <div className="fm-menu-separator" role="separator" />
          <button role="menuitem" data-fm-background-menuitem="true" data-fm-action="paste" disabled={props.operationRunning || !props.canPaste} onMouseEnter={() => setSubmenu(null)}>Paste</button>
        </>
      )}
    </div>
  );
}
