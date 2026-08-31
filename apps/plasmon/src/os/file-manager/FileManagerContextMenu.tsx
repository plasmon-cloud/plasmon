import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
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
          moveFocus(
            currentMenu,
            target,
            event.key === "ArrowDown" ? 1 : -1,
            nested ? ":scope > button:not(:disabled)" : '[data-fm-background-menuitem="true"]:not(:disabled)',
          );
        }
      }}
    >
      {props.node ? (
        <>
          {props.canRunScript ? (
            <>
              <button type="button" role="menuitem" onClick={() => props.onAction("runScript")}>Run</button>
              <button type="button" role="menuitem" disabled={!props.canEditScript} onClick={() => props.onAction("editScript")}>Edit</button>
            </>
          ) : (
            <button type="button" role="menuitem" onClick={() => props.onAction("open")}>Open</button>
          )}
          {props.node.kind !== "directory" ? (
            <button type="button" role="menuitem" disabled={!props.canOpenWith} title={props.canOpenWith ? undefined : "Association service unavailable"} onClick={() => props.onAction("openWith")}>
              Open With…
            </button>
          ) : null}
          {props.node.kind === "file" ? (
            <button type="button" role="menuitem" disabled={!props.canDownload} title={props.canDownload ? undefined : "Preparing download"} onClick={() => props.onAction("download")}>
              Download
            </button>
          ) : null}
          {props.canTranspileCmd ? <button type="button" role="menuitem" onClick={() => props.onAction("transpileRun")}>Transpile to .run</button> : null}
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
          <div style={{ position: "relative" }}>
            <button
              type="button"
              role="menuitem"
              data-fm-background-menuitem="true"
              data-fm-submenu="new"
              aria-haspopup="menu"
              aria-expanded={submenu === "new"}
              onMouseEnter={() => setSubmenu("new")}
              onClick={() => setSubmenu("new")}
            >New <span aria-hidden="true">›</span></button>
            {submenu === "new" ? (
              <div className="fm-context-menu" role="menu" aria-label="New submenu" style={{ position: "absolute", left: "calc(100% - 2px)", top: -5 }}>
                {NEW_ITEMS.map(([label, action], index) => (
                  <button key={action} autoFocus={index === 0} type="button" role="menuitem" onClick={() => { props.onAction(action); setSubmenu(null); }}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {props.desktopWallpaperMenu ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                role="menuitem"
                data-fm-background-menuitem="true"
                data-fm-submenu="wallpaper"
                aria-haspopup="menu"
                aria-expanded={submenu === "wallpaper"}
                disabled={props.desktopWallpaperMenu.disabled}
                onMouseEnter={() => setSubmenu("wallpaper")}
                onClick={() => setSubmenu("wallpaper")}
              >Change Wallpaper <span aria-hidden="true">›</span></button>
              {submenu === "wallpaper" ? (
                <div className="fm-context-menu" role="menu" aria-label="Change Wallpaper submenu" style={{ position: "absolute", left: "calc(100% - 2px)", top: -5 }}>
                  {props.desktopWallpaperMenu.choices.map((choice, index) => (
                    <button
                      key={choice.id}
                      autoFocus={index === 0}
                      type="button"
                      role="menuitemradio"
                      aria-checked={!!choice.selected}
                      onClick={() => { props.desktopWallpaperMenu?.onSelect(choice.id); props.onDismiss(); }}
                    >{choice.label}</button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button type="button" role="menuitem" data-fm-background-menuitem="true" disabled={props.operationRunning} onMouseEnter={() => setSubmenu(null)} onClick={() => props.onAction("import")}>Import Files…</button>
          <div className="fm-menu-separator" role="separator" />
          <button type="button" role="menuitem" data-fm-background-menuitem="true" disabled={props.operationRunning || !props.canPaste} onMouseEnter={() => setSubmenu(null)} onClick={() => props.onAction("paste")}>Paste</button>
        </>
      )}
    </div>
  );
}
