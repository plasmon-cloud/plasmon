import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import { preserveEditableContextMenu } from "../context-menu-boundary.ts";
import { ResourceIcon, type IconContext } from "../visual/index.ts";
import { fileVisualKind } from "./file-icons.ts";
import {
  deriveFileEntryRenderState,
  type FileEntryPosition,
  type FileEntryPresentation,
} from "./file-entry-state.ts";
import {
  RenameSelectionController,
  renameKeyAction,
  type InlineRenameState,
} from "./rename.ts";
import { shortcutTypeLabel } from "./shortcut.ts";
import { useFileEntryResolvedPresentation } from "./use-file-entry-presentation.ts";
import "./polish.scss";

export type { FileEntryPosition, FileEntryPresentation } from "./file-entry-state.ts";
export { fileEntryClassName } from "./file-entry-state.ts";

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const entryRef = useRef<HTMLDivElement | null>(null);
  const renameSelectionRef = useRef(new RenameSelectionController());
  const suppressBlurCommitRef = useRef(false);
  const renderState = deriveFileEntryRenderState({
    nodeId: node.id,
    selected,
    focused,
    dropTarget,
    presentation,
    position,
    renameNodeId: rename?.nodeId ?? null,
  });
  const resolvedPresentation = useFileEntryResolvedPresentation(fs, node, associations, entryRef);

  useLayoutEffect(() => {
    if (!renderState.isRenaming || !rename || !inputRef.current) {
      renameSelectionRef.current.reset();
      suppressBlurCommitRef.current = false;
      return;
    }
    suppressBlurCommitRef.current = false;
    renameSelectionRef.current.initialize(
      rename.session,
      inputRef.current,
      rename.initialName,
      node.kind === "directory",
    );
  }, [renderState.isRenaming, rename?.initialName, rename?.session, node.kind]);

  return (
    <div
      ref={(element) => {
        entryRef.current = element;
        setRef(element);
      }}
      className={renderState.className}
      style={renderState.style as CSSProperties | undefined}
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
      <span className={`fm-entry__icon fm-entry__icon--${resolvedPresentation.visualKind}`} aria-hidden="true">
        <ResourceIcon
          context={iconContext(presentation)}
          presentation={resolvedPresentation.iconPresentation}
          shortcut={resolvedPresentation.shortcut}
        />
      </span>
      <span className="fm-entry__selection-mark" aria-hidden="true">{selected ? "✓" : ""}</span>
      <span className="fm-entry__name" title={renderState.showCollapsedNameTitle ? node.name : undefined}>
        {renderState.isRenaming && rename ? (
          <>
            <input
              ref={inputRef}
              value={rename.value}
              aria-label={`Rename ${node.name}`}
              disabled={rename.busy}
              onPointerDown={(event: ReactPointerEvent<HTMLInputElement>) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={preserveEditableContextMenu}
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
      {renderState.showExpandedName ? (
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
