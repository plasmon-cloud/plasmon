import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import { ResourceIcon, type IconContext, type ResourceIconPresentation } from "../visual/index.ts";
import {
  fallbackFileResourcePresentation,
  fileVisualKind,
  resolveFileResourcePresentation,
  type FileResourcePresentation,
} from "./file-icons.ts";
import {
  RenameSelectionController,
  renameKeyAction,
  type InlineRenameState,
} from "./rename.ts";
import { shortcutTypeLabel } from "./shortcut.ts";
import { canLoadImageThumbnail, loadImageThumbnail, type LoadedImageThumbnail } from "./thumbnail.ts";
import "./polish.scss";

export type FileEntryPresentation = "desktop" | "grid" | "list" | "details";
export interface FileEntryPosition { x: number; y: number }

export interface FileEntryProps {
  fs: FsService;
  associations?: AssociationRegistry;
  node: FsNode;
  selected: boolean;
  focused: boolean;
  dropTarget?: boolean;
  presentation: FileEntryPresentation;
  position?: FileEntryPosition | undefined;
  rename: InlineRenameState | null;
  setRef: (element: HTMLDivElement | null) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

function formatCompactSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(node: FsNode): string {
  const visual = fileVisualKind(node);
  if (visual === "folder") return "File folder";
  if (visual === "markdown") return "Markdown document";
  if (visual === "image") return node.mime ?? "Image";
  if (visual === "video") return node.mime ?? "Video";
  if (visual === "shortcut") return shortcutTypeLabel(node);
  if (visual === "atom") return "Plasmon Atom";
  if (visual === "text") return node.mime ?? "Text document";
  return node.mime ?? "File";
}

function iconContext(presentation: FileEntryPresentation): IconContext {
  if (presentation === "desktop") return "desktop";
  if (presentation === "grid") return "file-grid";
  return "file-list";
}

export function fileEntryClassName(
  presentation: FileEntryPresentation,
  selected: boolean,
  focused: boolean,
  renaming: boolean,
  dropTarget: boolean,
): string {
  return `fm-entry fm-entry--${presentation}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}${renaming ? " is-renaming" : ""}${dropTarget ? " is-drop-target" : ""}`;
}

export const FileEntry = memo(function FileEntry({
  fs,
  associations,
  node,
  selected,
  focused,
  dropTarget = false,
  presentation,
  position,
  rename,
  setRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: FileEntryProps) {
  const isRenaming = rename?.nodeId === node.id;
  const style: CSSProperties | undefined = presentation === "desktop" && position
    ? ({
        left: position.x,
        top: position.y,
        "--fm-desktop-entry-x": `${position.x}px`,
      } as CSSProperties)
    : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const entryRef = useRef<HTMLDivElement | null>(null);
  const renameSelectionRef = useRef(new RenameSelectionController());
  const suppressBlurCommitRef = useRef(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [resourcePresentation, setResourcePresentation] = useState<FileResourcePresentation>(
    () => fallbackFileResourcePresentation(node, associations),
  );

  useLayoutEffect(() => {
    if (!isRenaming || !rename || !inputRef.current) {
      renameSelectionRef.current.reset();
      suppressBlurCommitRef.current = false;
      return;
    }
    suppressBlurCommitRef.current = false;
    renameSelectionRef.current.initialize(rename.session,
      inputRef.current,
      rename.initialName,
      node.kind === "directory",
    );
  }, [isRenaming, rename?.initialName, rename?.session]);

  useEffect(() => {
    let active = true;
    const fallback = fallbackFileResourcePresentation(node, associations);
    setResourcePresentation(fallback);
    void resolveFileResourcePresentation(fs, node, associations)
      .then((resolved) => {
        if (active) setResourcePresentation(resolved);
      })
      .catch(() => {
        if (active) setResourcePresentation(fallback);
      });
    return () => { active = false; };
  }, [associations, fs, node]);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    let loaded: LoadedImageThumbnail | null = null;
    setThumbnailUrl(null);
    if (!canLoadImageThumbnail(node)) return undefined;

    const load = () => {
      void loadImageThumbnail(fs, node)
        .then((thumbnail) => {
          if (!thumbnail) return;
          if (!active) {
            thumbnail.revoke();
            return;
          }
          loaded?.revoke();
          loaded = thumbnail;
          setThumbnailUrl(thumbnail.url);
        })
        .catch(() => {
          if (active) setThumbnailUrl(null);
        });
    };

    const element = entryRef.current;
    if (typeof IntersectionObserver === "undefined" || !element) {
      load();
    } else {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        observer = null;
        load();
      }, { rootMargin: "96px" });
      observer.observe(element);
    }

    return () => {
      active = false;
      observer?.disconnect();
      loaded?.revoke();
    };
  }, [fs, node.contentHash, node.id, node.mime, node.modifiedAt, node.name, node.size]);

  const visualKind = fileVisualKind(node);
  const iconPresentation: ResourceIconPresentation = thumbnailUrl
    ? { kind: "thumbnail", src: thumbnailUrl, mediaKind: "image" }
    : resourcePresentation.presentation;

  return (
    <div
      ref={(element) => {
        entryRef.current = element;
        setRef(element);
      }}
      className={fileEntryClassName(presentation, selected, focused, isRenaming, dropTarget)}
      style={style}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-fm-node-id={node.id}
      data-fm-kind={node.kind}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <span className={`fm-entry__icon fm-entry__icon--${visualKind}`} aria-hidden="true">
        <ResourceIcon
          context={iconContext(presentation)}
          presentation={iconPresentation}
          shortcut={!thumbnailUrl && resourcePresentation.shortcut}
        />
      </span>
      <span className="fm-entry__selection-mark" aria-hidden="true">{selected ? "✓" : ""}</span>
      <span className="fm-entry__name" title={!selected && !isRenaming ? node.name : undefined}>
        {isRenaming && rename ? (
          <>
            <input
              ref={inputRef}
              value={rename.value}
              aria-label={`Rename ${node.name}`}
              disabled={rename.busy}
              onPointerDown={(event: ReactPointerEvent<HTMLInputElement>) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event: ReactChangeEvent<HTMLInputElement>) => {
                suppressBlurCommitRef.current = false;
                onRenameChange(event.target.value);
              }}
              onBlur={() => {
                if (!rename.busy && !suppressBlurCommitRef.current) onRenameCommit();
              }}
              onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                const action = renameKeyAction(event.key);
                if (!action) return;
                event.preventDefault();
                event.stopPropagation();
                suppressBlurCommitRef.current = true;
                if (action === "commit") onRenameCommit();
                else onRenameCancel();
              }}
            />
            {rename.error ? <span className="fm-inline-error" role="alert">{rename.error}</span> : null}
          </>
        ) : node.name}
      </span>
      {presentation === "desktop" && (selected || focused) && !isRenaming ? (
        <span className="fm-entry__expanded-name" aria-hidden="true">{node.name}</span>
      ) : null}
      {presentation === "details" ? (
        <>
          <span className="fm-entry__type">{typeLabel(node)}</span>
          <span className="fm-entry__size">{node.kind === "directory" ? "—" : formatCompactSize(node.size)}</span>
          <span className="fm-entry__modified">{new Date(node.modifiedAt).toLocaleString()}</span>
        </>
      ) : null}
    </div>
  );
});
