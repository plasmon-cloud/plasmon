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

interface FileManagerContextSubmenuItem {
  id: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

function submenuItems(menu: HTMLDivElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(
    '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)',
  ));
}

function FileManagerContextSubmenu({
  label,
  disabled = false,
  items,
}: {
  label: string;
  disabled?: boolean;
  items: readonly FileManagerContextSubmenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef<"first" | "last" | null>(null);

  useLayoutEffect(() => {
    if (!open || !pendingFocusRef.current) return;
    const candidates = submenuItems(menuRef.current);
    const target = pendingFocusRef.current === "last"
      ? candidates.at(-1)
      : candidates[0];
    pendingFocusRef.current = null;
    target?.focus();
  }, [open]);

  const openAndFocus = (target: "first" | "last" = "first") => {
    pendingFocusRef.current = target;
    setOpen(true);
  };

  const focusRelativeItem = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    direction: 1 | -1,
  ) => {
    const candidates = submenuItems(menuRef.current);
    if (candidates.length === 0) return;
    const current = candidates.indexOf(event.target as HTMLElement);
    const next = current < 0
      ? direction > 0 ? 0 : candidates.length - 1
      : (current + direction + candidates.length) % candidates.length;
    candidates[next]?.focus();
  };

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => { if (!disabled) setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        data-fm-menu-top-level="true"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            openAndFocus("first");
          }
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
            if (event.key === "ArrowDown") {
              event.preventDefault();
              event.stopPropagation();
              focusRelativeItem(event, 1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              event.stopPropagation();
              focusRelativeItem(event, -1);
            } else if (event.key === "Home") {
              event.preventDefault();
              event.stopPropagation();
              submenuItems(menuRef.current)[0]?.focus();
            } else if (event.key === "End") {
              event.preventDefault();
              event.stopPropagation();
              submenuItems(menuRef.current).at(-1)?.focus();
            } else if (event.key === "ArrowLeft" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
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
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
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
    menu.querySelector<HTMLElement>('[data-fm-menu-top-level="true"]:not(:disabled)')?.focus();
  }, [props.state.nodeId, props.state.x, props.state.y]);

  const focusTopLevelItem = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    direction: 1 | -1,
  ) => {
    const candidates = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
      '[data-fm-menu-top-level="true"]:not(:disabled)',
    ) ?? []);
    if (candidates.length === 0) return;
    const current = candidates.indexOf(event.target as HTMLElement);
    const next = current < 0
      ? direction > 0 ? 0 : candidates.length - 1
      : (current + direction + candidates.length) % candidates.length;
    candidates[next]?.focus();
  };

  const topLevel = { "data-fm-menu-top-level": "true" } as const;

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
        const target = event.target as HTMLElement;
        if (target.dataset.fmMenuTopLevel !== "true") return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusTopLevelItem(event, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusTopLevelItem(event, -1);
        } else if (event.key === "Home") {
          event.preventDefault();
          Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
            '[data-fm-menu-top-level="true"]:not(:disabled)',
          ) ?? [])[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          Array.from(menuRef.current?.querySelectorAll<HTMLElement>(
            '[data-fm-menu-top-level="true"]:not(:disabled)',
          ) ?? []).at(-1)?.focus();
        }
      }}
    >
      {props.node ? (
        <>
          <button {...topLevel} type="button" role="menuitem" onClick={() => props.onAction("open")}>Open</button>
          {props.node.kind !== "directory" ? (
            <button
              {...topLevel}
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
              {...topLevel}
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
          <button {...topLevel} type="button" role="menuitem" onClick={() => props.onAction("cut")}>Cut</button>
          <button {...topLevel} type="button" role="menuitem" onClick={() => props.onAction("copy")}>Copy</button>
          <button {...topLevel} type="button" role="menuitem" disabled={!props.canCreateShortcut} onClick={() => props.onAction("createShortcut")}>Create Shortcut</button>
          <button {...topLevel} type="button" role="menuitem" disabled={!props.canCreateShortcut} onClick={() => props.onAction("sendToDesktop")}>Send to Desktop (create shortcut)</button>
          <button {...topLevel} type="button" role="menuitem" onClick={() => props.onAction("rename")}>Rename</button>
          <button {...topLevel} type="button" role="menuitem" onClick={() => props.onAction("delete")}>Delete</button>
          <div className="fm-menu-separator" role="separator" />
          <button {...topLevel} type="button" role="menuitem" onClick={() => props.onAction("properties")}>Properties</button>
        </>
      ) : (
        <>
          <FileManagerContextSubmenu
            label="New"
            items={[
              { id: "folder", label: "New Folder", onSelect: () => props.onAction("newFolder") },
              { id: "text", label: "New Text Document", onSelect: () => props.onAction("newText") },
              { id: "markdown", label: "New Markdown Document", onSelect: () => props.onAction("newMarkdown") },
            ]}
          />
          {props.desktopWallpaperMenu ? (
            <FileManagerContextSubmenu
              label="Change Wallpaper"
              disabled={props.desktopWallpaperMenu.disabled}
              items={props.desktopWallpaperMenu.choices.map((choice) => ({
                id: choice.id,
                label: choice.label,
                checked: Boolean(choice.selected),
                onSelect: () => props.desktopWallpaperMenu?.onSelect(choice.id),
              }))}
            />
          ) : null}
          <button {...topLevel} type="button" role="menuitem" disabled={props.operationRunning} onClick={() => props.onAction("import")}>Import Files…</button>
          <div className="fm-menu-separator" role="separator" />
          <button {...topLevel} type="button" role="menuitem" disabled={props.operationRunning || !props.canPaste} onClick={() => props.onAction("paste")}>Paste</button>
        </>
      )}
    </div>
  );
}
