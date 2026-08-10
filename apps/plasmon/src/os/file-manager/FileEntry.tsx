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
import type { FsNode, FsService } from "../contracts/index.ts";
import { fileVisualKind, iconForFile } from "./file-icons.ts";
import {
  RenameSelectionController,
  renameKeyAction,
  type InlineRenameState,
} from "./rename.ts";
import { canLoadImageThumbnail, loadImageThumbnail, type LoadedImageThumbnail } from "./thumbnail.ts";
import "./polish.scss";

export type FileEntryPresentation = "desktop" | "grid" | "list" | "details";
export interface FileEntryPosition { x: number; y: number }

export interface FileEntryProps {
  fs: FsService;
  node: FsNode;
  selected: boolean;
  focused: boolean;
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
  if (visual === "shortcut") return "Shortcut";
  if (visual === "atom") return "Plasmon Atom";
  if (visual === "text") return node.mime ?? "Text document";
  return node.mime ?? "File";
}

export const FileEntry = memo(function FileEntry({
  fs,
  node,
  selected,
  focused,
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
    ? { left: position.x, top: position.y }
    : undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const entryRef = useRef<HTMLDivElement | null>(null);
  const renameSelectionRef = useRef(new RenameSelectionController());
  const suppressBlurCommitRef = useRef(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!isRenaming || !rename || !inputRef.current) {
      renameSelectionRef.current.reset();
      suppressBlurCommitRef.current = false;
      return;
    }
    suppressBlurCommitRef.current = false;
    renameSelectionRef.current.initialize(rename.session, inputRef.current, rename.initialName);
  }, [isRenaming, rename?.initialName, rename?.session]);

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

  return (
    <div
      ref={(element) => {
        entryRef.current = element;
        setRef(element);
      }}
      className={`fm-entry fm-entry--${presentation}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}`}
      style={style}
      role="option"
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
        {thumbnailUrl ? <img className="fm-entry__thumbnail" src={thumbnailUrl} alt="" draggable={false} /> : iconForFile(node)}
      </span>
      <span className="fm-entry__selection-mark" aria-hidden="true">{selected ? "✓" : ""}</span>
      <span className="fm-entry__name">
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
