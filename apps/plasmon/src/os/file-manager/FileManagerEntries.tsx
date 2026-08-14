import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { AssociationRegistry, FsNode, FsService, NodeId } from "../contracts/index.ts";
import { FileEntry } from "./FileEntry.tsx";
import type { SelectionState } from "./model.ts";
import type { InlineRenameState } from "./rename.ts";
import type { DesktopPosition } from "./render-state.ts";
import type { FileManagerViewStrategy } from "./view-strategy.ts";

type FileManagerEntriesMode =
  | {
    kind: "desktop";
    positions: Readonly<Record<NodeId, DesktopPosition>>;
  }
  | {
    kind: "view";
    strategy: FileManagerViewStrategy;
  };

interface FileManagerEntriesProps {
  fs: FsService;
  associations?: AssociationRegistry;
  nodes: readonly FsNode[];
  selection: SelectionState;
  dropTargetId: NodeId | null;
  mode: FileManagerEntriesMode;
  rename: InlineRenameState | null;
  setEntryRef: (id: NodeId, element: HTMLDivElement | null) => void;
  onPointerDown: (node: FsNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onOpen: (node: FsNode) => void;
  onContextMenu: (node: FsNode, event: ReactMouseEvent<HTMLDivElement>) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

export function FileManagerEntries(props: FileManagerEntriesProps) {
  const strategy = props.mode.kind === "view" ? props.mode.strategy : null;
  const entryPresentation = strategy?.entryPresentation ?? "desktop";
  const entriesClassName = strategy
    ? `fm-entries fm-entries--${strategy.kind}`
    : "fm-entries";

  return (
    <>
      {strategy?.detailsColumns ? (
        <div className="fm-details-head" aria-hidden="true">
          {strategy.detailsColumns.map((column) => <span key={column}>{column}</span>)}
        </div>
      ) : null}
      <div className={entriesClassName}>
        {props.nodes.map((node) => (
          <FileEntry
            key={node.id}
            fs={props.fs}
            {...(props.associations ? { associations: props.associations } : {})}
            node={node}
            selected={props.selection.ids.has(node.id)}
            focused={props.selection.focus === node.id}
            dropTarget={props.dropTargetId === node.id}
            presentation={entryPresentation}
            {...(props.mode.kind === "desktop"
              ? { position: props.mode.positions[node.id] }
              : {})}
            rename={props.rename}
            setRef={(element) => props.setEntryRef(node.id, element)}
            onPointerDown={(event) => props.onPointerDown(node, event)}
            onPointerMove={props.onPointerMove}
            onPointerUp={props.onPointerUp}
            onPointerCancel={props.onPointerCancel}
            onDoubleClick={() => props.onOpen(node)}
            onContextMenu={(event) => props.onContextMenu(node, event)}
            onRenameChange={props.onRenameChange}
            onRenameCommit={props.onRenameCommit}
            onRenameCancel={props.onRenameCancel}
          />
        ))}
      </div>
    </>
  );
}
