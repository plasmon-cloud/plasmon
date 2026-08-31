import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
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
  canCreateShortcut: boolean;
  operationRunning: boolean;
  canPaste: boolean;
  desktopWallpaperMenu?: FileManagerDesktopWallpaperMenu;
  onAction: (action: FileManagerContextMenuAction) => void;
  onDismiss: () => void;
}

interface SubmenuItem {
  id: string;
  label: string;
  checked?: boolean;
  onSelect: () => void;
}

function enabledSubmenuItems(menu: HTMLDivElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(
    '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)',
  ));
}

function ContextSubmenu({
  label,
  disabled = false,
  items,
  open,
  onOpen,
  onClose,
}: {
  label: string;
  disabled?: boolean;
  items: readonly SubmenuItem[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const focusOnOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (!open || !focusOnOpenRef.current) return;
    focusOnOpenRef.current = false;
    enabledSubmenuItems(menuRef.current)[0]?.focus();
  }, [open]);

  const openWithFocus = () => {
    focusOnOpenRef.current = true;
    onOpen();
  };

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>, delta: 1 | -1) => {
    const candidates = enabledSubmenuItems(menuRef.current);
    if (candidates.length === 0) return;
    const current = candidates.indexOf(event.target as HTMLElement);
    const next = current < 0
      ? delta > 0 ? 0 : candidates.length - 1
      : (current + delta + candidates.length) % candidates.length;
    candidates[next]?.focus();
  };

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => { if (!disabled) onOpen(); }}
      onBlur={(event) => {
        const container = event.currentTarget;
        const next = event.relatedTarget;
        if (next instanceof Node) {
          if (!container.contains(next)) onClose();
          return;
        }
        queueMicrotask(() => {
          if (!container.contains(document.activeElement)) onClose();
        });
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        data-fm-background-menuitem="true"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          openWithFocus();
        }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}
      >
        <span>{label}</span><span aria-hidden="true">›</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="fm-context-menu"
          role="menu"
          aria-label={`${label} submenu`}
          style={{ position: "absolute", left: "calc(100% - 2px)", top: -5 }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              event.stopPropagation();
              moveFocus(event, event.key === "ArrowDown" ? 1 : -1);
              return;
            }
            if (event.key === "ArrowLeft" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
              triggerRef.current?.focus();
            }
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              {...(item.checked === undefined ? {} : { "aria-checked": item.checked })}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FileManagerContextMenu(props: FileManagerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<"new" | "wallpaper" | null>(null);

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
    menu.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
  }, [props.state.nodeId, props.state.x, props.state.y]);

  const moveBackgroundFocus = (event: ReactKeyboardEvent<HTMLDivElement>, delta: 1 | -1) => {
    const candidates = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
      '[data-fm-background-menuitem="true"]:not(:disabled)',
    ) ?? []);
    if (candidates.length === 0) return;
    const current = candidates.indexOf(event.target as HTMLElement);
    const next = current < 0
      ? delta > 0 ? 0 : candidates.length - 1
      : (current + delta + candidates.length) % candidates.length;
    candidates[next]?.focus();
  };

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
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          props.onDismiss();
          return;
        }
        if (!props.node && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          const target = event.target as HTMLElement;
          if (target.dataset.fmBackgroundMenuitem !== "true") return;
          event.preventDefault();
          moveBackgroundFocus(event, event.key === "ArrowDown" ? 1 : -1);
        }
      }}
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
          <ContextSubmenu
            label="New"
            items={[
              { id: "folder", label: "New Folder", onSelect: () => props.onAction("newFolder") },
              { id: "text", label: "New Text Document", onSelect: () => props.onAction("newText") },
              { id: "markdown", label: "New Markdown Document", onSelect: () => props.onAction("newMarkdown") },
            ]}
            open={activeSubmenu === "new"}
            onOpen={() => setActiveSubmenu("new")}
            onClose={() => setActiveSubmenu(null)}
          />
          {props.desktopWallpaperMenu ? (
            <ContextSubmenu
              label="Change Wallpaper"
              disabled={props.desktopWallpaperMenu.disabled}
              items={props.desktopWallpaperMenu.choices.map((choice) => ({
                id: choice.id,
                label: choice.label,
                checked: Boolean(choice.selected),
                onSelect: () => {
                  props.desktopWallpaperMenu?.onSelect(choice.id);
                  props.onDismiss();
                },
              }))}
              open={activeSubmenu === "wallpaper"}
              onOpen={() => setActiveSubmenu("wallpaper")}
              onClose={() => setActiveSubmenu(null)}
            />
          ) : null}
          <button
            type="button"
            role="menuitem"
            data-fm-background-menuitem="true"
            disabled={props.operationRunning}
            onMouseEnter={() => setActiveSubmenu(null)}
            onClick={() => props.onAction("import")}
          >Import Files…</button>
          <div className="fm-menu-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            data-fm-background-menuitem="true"
            disabled={props.operationRunning || !props.canPaste}
            onMouseEnter={() => setActiveSubmenu(null)}
            onClick={() => props.onAction("paste")}
          >Paste</button>
        </>
      )}
    </div>
  );
}
