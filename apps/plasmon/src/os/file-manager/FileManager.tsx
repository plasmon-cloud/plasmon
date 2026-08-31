import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsService,
  NodeId,
  OpenService,
  ProcessController,
} from "../contracts/index.ts";
import { claimFirstPartyContextMenu } from "../context-menu-boundary.ts";
import {
  DiagnosticEvent,
  DiagnosticSubsystem,
  type DiagnosticService,
} from "../diagnostics/index.ts";
import {
  FileOperationClipboard,
  emptySelection,
  selectNode,
  type SelectionState,
} from "./model.ts";
import type { FileManagerOpenAuthority } from "./activation.ts";
import type { FileManagerTrashAuthority } from "./delete.ts";
import type { IncomingDropPlacementIntent } from "./drop-placement.ts";
import { ErrorBanner } from "./ErrorBanner.tsx";
import { FileManagerCommandBar } from "./FileManagerCommandBar.tsx";
import {
  FileManagerContextMenu,
  type FileManagerContextMenuAction,
  type FileManagerContextMenuState,
  type FileManagerDesktopWallpaperMenu,
} from "./FileManagerContextMenu.tsx";
import { FileManagerDialogs } from "./FileManagerDialogs.tsx";
import { FileManagerEntries } from "./FileManagerEntries.tsx";
import { FileOperationState, type FileOperationSnapshot } from "./operation-state.ts";
import { presentFileOperation } from "./operation-presentation.ts";
import { readSharedShortcut } from "./shortcut.ts";
import { activateExecutableScript } from "./script-activation.ts";
import {
  deriveFileManagerRenderState,
  type DesktopPosition,
  type FileManagerPresentation,
  type FileManagerSnapshot,
} from "./render-state.ts";
import { useFileManagerCommands } from "./use-file-manager-commands.ts";
import { useFileManagerDirectoryState } from "./use-file-manager-directory-state.ts";
import { useFileManagerKeyboardAdapter } from "./use-file-manager-keyboard-adapter.ts";
import { useFileManagerPointerAdapter } from "./use-file-manager-pointer-adapter.ts";
import { useFileManagerRename } from "./use-file-manager-rename.ts";
import { fileManagerViewStrategy } from "./view-strategy.ts";
import "./file-manager.scss";

export type {
  DesktopPosition,
  FileManagerPresentation,
  FileManagerSnapshot,
} from "./render-state.ts";

export interface FileManagerProps {
  directoryId: NodeId;
  fs: FsService;
  diagnostics?: DiagnosticService;
  openAuthority: FileManagerOpenAuthority;
  trashAuthority: FileManagerTrashAuthority;
  fsEvents?: FsEventSource;
  associations?: AssociationRegistry;
  openService?: OpenService;
  process?: ProcessController;
  clipboard: FileOperationClipboard;
  operationState?: FileOperationState;
  presentation?: FileManagerPresentation;
  sort?: FsListOptions["sort"];
  filterQuery?: string;
  positions?: Readonly<Record<NodeId, DesktopPosition>>;
  desktopWallpaperMenu?: FileManagerDesktopWallpaperMenu;
  onDesktopReposition?: (
    ids: readonly NodeId[],
    delta: { dx: number; dy: number },
    bounds: { width: number; height: number },
  ) => void | Promise<void>;
  onIncomingDropPlacement?: (intent: IncomingDropPlacementIntent) => void | Promise<void>;
  onOpenDirectory?: (node: FsNode) => void | Promise<void>;
  onTranspileCmd?: (node: FsNode) => void | Promise<void>;
  onSnapshot?: (snapshot: FileManagerSnapshot) => void;
  confirmDelete?: (nodes: readonly FsNode[]) => boolean | Promise<boolean>;
  className?: string;
}

export function FileManager({
  directoryId,
  fs,
  diagnostics,
  openAuthority,
  trashAuthority,
  fsEvents,
  associations,
  openService,
  process,
  clipboard,
  operationState: providedOperationState,
  presentation = "grid",
  sort = "name",
  filterQuery = "",
  positions,
  desktopWallpaperMenu,
  onDesktopReposition,
  onIncomingDropPlacement,
  onOpenDirectory,
  onTranspileCmd,
  onSnapshot,
  confirmDelete,
  className,
}: FileManagerProps) {
  const [selection, setSelection] = useState<SelectionState>(() => emptySelection());
  const [contextMenu, setContextMenu] = useState<FileManagerContextMenuState | null>(null);
  const [openWithNode, setOpenWithNode] = useState<FsNode | null>(null);
  const [propertiesNode, setPropertiesNode] = useState<FsNode | null>(null);
  const [localOperationState] = useState(() => new FileOperationState());
  const operationState = providedOperationState ?? localOperationState;
  const [operation, setOperation] = useState<FileOperationSnapshot>(() => operationState.snapshot());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cancelDownloadPreparationRef = useRef<() => void>(() => {});
  const fileManagerLog = useMemo(() => diagnostics?.for(DiagnosticSubsystem.FileManager) ?? null, [diagnostics]);

  const closeContextMenu = () => {
    cancelDownloadPreparationRef.current();
    setContextMenu(null);
  };

  const directory = useFileManagerDirectoryState({
    directoryId,
    fs,
    sort,
    setSelection,
    ...(fsEvents ? { fsEvents } : {}),
  });

  const renderState = useMemo(
    () => deriveFileManagerRenderState({
      nodes: directory.nodes,
      selection,
      filterQuery,
      presentation,
      ...(positions ? { positions } : {}),
    }),
    [directory.nodes, filterQuery, positions, presentation, selection],
  );
  const viewStrategy = fileManagerViewStrategy(presentation);

  useEffect(() => {
    setOperation(operationState.snapshot());
    return operationState.subscribe(setOperation);
  }, [operationState]);

  useEffect(() => {
    if (!fileManagerLog || operation.kind !== "move" || operation.status !== "failed") return;
    const fields = {
      total: operation.totalItems,
      succeeded: operation.succeededItems,
      failed: operation.failedItems,
    };
    if (operation.succeededItems > 0) fileManagerLog.warn(DiagnosticEvent.FileManager.MovePartial, fields);
    else fileManagerLog.warn(DiagnosticEvent.FileManager.MoveFailed, fields);
  }, [fileManagerLog, operation]);

  useEffect(() => {
    onSnapshot?.(renderState.snapshot);
  }, [onSnapshot, renderState.snapshot]);

  const rename = useFileManagerRename({
    fs,
    refresh: directory.refresh,
    setError: directory.setError,
    closeContextMenu,
  });

  const commands = useFileManagerCommands({
    directoryId,
    fs,
    ...(diagnostics ? { diagnostics } : {}),
    openAuthority,
    trashAuthority,
    clipboard,
    operationState,
    nodes: directory.nodes,
    selection,
    setSelection,
    setError: directory.setError,
    refresh: directory.refresh,
    fileInputRef,
    beginInlineRename: rename.begin,
    closeContextMenu,
    ...(onOpenDirectory ? { onOpenDirectory } : {}),
    ...(confirmDelete ? { confirmDelete } : {}),
  });
  cancelDownloadPreparationRef.current = commands.cancelDownloadPreparation;

  const pointer = useFileManagerPointerAdapter({
    fs,
    trashAuthority,
    nodes: directory.nodes,
    orderedIds: renderState.orderedIds,
    selection,
    presentation,
    renameNodeId: rename.rename?.nodeId ?? null,
    operationState,
    refresh: directory.refresh,
    setSelection,
    setError: directory.setError,
    closeContextMenu,
    ...(onDesktopReposition ? { onDesktopReposition } : {}),
    ...(onIncomingDropPlacement ? { onIncomingDropPlacement } : {}),
  });

  const closeOverlays = () => {
    closeContextMenu();
    setOpenWithNode(null);
    setPropertiesNode(null);
  };

  const keyboard = useFileManagerKeyboardAdapter({
    nodes: directory.nodes,
    orderedIds: renderState.orderedIds,
    selection,
    presentation,
    renameActive: rename.rename !== null,
    overlayOpen: Boolean(contextMenu || openWithNode || propertiesNode),
    entryRectangles: pointer.entryRectangles,
    setSelection,
    onCopy: () => commands.copySelection(),
    onCut: () => commands.cutSelection(),
    onPaste: () => void commands.paste(),
    onDelete: () => void commands.removeSelected(),
    onRename: rename.start,
    onOpen: (node) => void commands.openNode(node),
    onCancelRename: rename.cancel,
    onCloseOverlays: closeOverlays,
  });

  const contextNode = contextMenu?.nodeId
    ? directory.nodes.find((node) => node.id === contextMenu.nodeId) ?? null
    : null;
  const canOpenWith = Boolean(
    contextNode
      && contextNode.kind !== "directory"
      && !readSharedShortcut(contextNode)
      && associations
      && openService,
  );
  const operationPresentation = presentFileOperation(operation);
  const canPaste = Boolean(clipboard.snapshot());
  const scriptExtension = contextNode?.kind === "file"
    ? contextNode.name.toLowerCase().match(/\.(cmd|run)$/u)?.[1] ?? null
    : null;
  const canRunScript = Boolean(scriptExtension && openService && associations?.getHandler("native:terminal"));
  const canEditScript = Boolean(scriptExtension && openService);
  const canTranspileCmd = Boolean(scriptExtension === "cmd" && onTranspileCmd);

  const menuAction = (action: FileManagerContextMenuAction) => {
    if (action === "newFolder") {
      void commands.createNewFolder();
      return;
    }
    if (action === "newText") {
      void commands.createNewDocument("text");
      return;
    }
    if (action === "newMarkdown") {
      void commands.createNewDocument("markdown");
      return;
    }
    if (action === "newCmd") {
      void commands.createNewDocument("cmd");
      return;
    }
    if (action === "newRun") {
      void commands.createNewDocument("run");
      return;
    }
    if (action === "import") {
      commands.triggerImport();
      return;
    }
    if (action === "paste") {
      closeContextMenu();
      void commands.paste();
      return;
    }
    if (action === "createShortcut") {
      void commands.createShortcutFromSelection();
      return;
    }
    if (action === "sendToDesktop") {
      void commands.sendSelectionToDesktop();
      return;
    }
    if (!contextNode) return;

    if (action === "open") {
      void commands.openNode(contextNode);
      return;
    }
    if (action === "runScript") {
      closeContextMenu();
      if (!openService || !canRunScript) return;
      void activateExecutableScript(openService, contextNode)
        .catch((cause: unknown) => directory.setError(cause instanceof Error ? cause.message : String(cause)));
      return;
    }
    if (action === "editScript") {
      closeContextMenu();
      if (!openService || !canEditScript) return;
      void openService.open("native:text", { nodeId: contextNode.id })
        .catch((cause: unknown) => directory.setError(cause instanceof Error ? cause.message : String(cause)));
      return;
    }
    if (action === "openWith") {
      closeContextMenu();
      if (canOpenWith) setOpenWithNode(contextNode);
      return;
    }
    if (action === "download") {
      void commands.downloadNode(contextNode);
      return;
    }
    if (action === "transpileRun") {
      closeContextMenu();
      if (!onTranspileCmd || !canTranspileCmd) return;
      void Promise.resolve(onTranspileCmd(contextNode))
        .then(() => directory.refresh())
        .catch((cause: unknown) => directory.setError(cause instanceof Error ? cause.message : String(cause)));
      return;
    }
    if (action === "cut") {
      commands.cutSelection(
        selection.ids.has(contextNode.id) ? selection.ids : [contextNode.id],
      );
      closeContextMenu();
      return;
    }
    if (action === "copy") {
      commands.copySelection(
        selection.ids.has(contextNode.id) ? selection.ids : [contextNode.id],
      );
      closeContextMenu();
      return;
    }
    if (action === "rename") {
      rename.start(contextNode);
      return;
    }
    if (action === "delete") {
      const items = selection.ids.has(contextNode.id)
        ? commands.selectedNodes()
        : [contextNode];
      closeContextMenu();
      void commands.removeNodes(items);
      return;
    }
    if (action === "properties") {
      closeContextMenu();
      if (associations && openService) setPropertiesNode(contextNode);
      else if (process) {
        void process.open("native:properties", { nodeId: contextNode.id });
      }
    }
  };

  const openContextMenuForNode = (
    node: FsNode,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if (!claimFirstPartyContextMenu(event)) return;
    event.stopPropagation();
    if (!selection.ids.has(node.id)) {
      setSelection(selectNode(emptySelection(), renderState.orderedIds, node.id));
    }
    if (node.kind === "file") commands.prepareDownload(node);
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  };

  return (
    <div
      ref={pointer.rootRef}
      className={`fm-root fm-root--${presentation}${className ? ` ${className}` : ""}`}
      tabIndex={0}
      role="listbox"
      aria-label="Files"
      aria-multiselectable="true"
      onKeyDownCapture={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('[data-fm-context-menu="true"]')) return;
        keyboard.handleKeyDown(event);
      }}
      onPointerDown={pointer.handleBackgroundPointerDown}
      onPointerMove={pointer.handleBackgroundPointerMove}
      onPointerUp={pointer.finishMarquee}
      onPointerCancel={pointer.finishMarquee}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (!claimFirstPartyContextMenu(event)) return;
        const element = (event.target as HTMLElement)
          .closest<HTMLElement>("[data-fm-node-id]");
        const id = element?.dataset.fmNodeId ?? null;
        if (id && !selection.ids.has(id)) {
          setSelection(selectNode(emptySelection(), renderState.orderedIds, id));
        }
        if (id) {
          const node = directory.nodes.find((candidate) => candidate.id === id);
          if (node?.kind === "file") commands.prepareDownload(node);
        }
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: id });
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event: ReactChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void commands.importFiles(files);
        }}
      />

      {presentation !== "desktop" ? (
        <FileManagerCommandBar
          selectionCount={selection.ids.size}
          canCreateShortcut={commands.canCreateShortcut}
          canPaste={canPaste}
          operationRunning={operationPresentation.running}
          onNewFolder={() => void commands.createNewFolder()}
          onNewText={() => void commands.createNewDocument("text")}
          onNewMarkdown={() => void commands.createNewDocument("markdown")}
          onImport={commands.triggerImport}
          onCopy={() => commands.copySelection()}
          onCut={() => commands.cutSelection()}
          onCreateShortcut={() => void commands.createShortcutFromSelection()}
          onSendToDesktop={() => void commands.sendSelectionToDesktop()}
          onPaste={() => void commands.paste()}
          onDelete={() => void commands.removeSelected()}
          onRefresh={() => void directory.refresh()}
        />
      ) : null}

      {directory.error ? (
        <ErrorBanner
          message={directory.error}
          onDismiss={() => directory.setError(null)}
          onRetry={() => void directory.refresh()}
        />
      ) : null}
      {operationPresentation.message ? (
        <p className="fm-operation-status" role="status">
          {operationPresentation.message}
        </p>
      ) : null}
      {presentation !== "desktop"
        && directory.loading
        && directory.nodes.length === 0 ? (
        <p className="fm-empty">Loading…</p>
      ) : null}

      <FileManagerEntries
        directoryId={directoryId}
        fs={fs}
        {...(associations ? { associations } : {})}
        nodes={renderState.visibleNodes}
        selection={selection}
        dropTargetId={pointer.dropTargetId}
        mode={viewStrategy
          ? { kind: "view", strategy: viewStrategy }
          : { kind: "desktop", positions: renderState.desktopPositions }}
        rename={rename.rename}
        setEntryRef={pointer.setEntryRef}
        onPointerDown={pointer.handleEntryPointerDown}
        onPointerMove={pointer.handleEntryPointerMove}
        onPointerUp={(event) => void pointer.handleEntryPointerUp(event)}
        onPointerCancel={pointer.handleEntryPointerCancel}
        onOpen={(node) => void commands.openNode(node)}
        onContextMenu={openContextMenuForNode}
        onRenameChange={rename.change}
        onRenameCommit={() => void rename.commit()}
        onRenameCancel={rename.cancel}
      />

      {!directory.loading && renderState.visibleNodes.length === 0 ? (
        <p className="fm-empty">This folder is empty.</p>
      ) : null}
      {pointer.marquee ? (
        <div className="fm-marquee" aria-hidden="true" style={pointer.marquee} />
      ) : null}

      {contextMenu ? (
        <FileManagerContextMenu
          state={contextMenu}
          node={contextNode}
          canOpenWith={canOpenWith}
          canDownload={contextNode?.kind === "file" && commands.isDownloadReady(contextNode)}
          canTranspileCmd={canTranspileCmd}
          canRunScript={canRunScript}
          canEditScript={canEditScript}
          canCreateShortcut={commands.canCreateShortcut}
          operationRunning={operationPresentation.running}
          canPaste={canPaste}
          {...(presentation === "desktop" && desktopWallpaperMenu ? { desktopWallpaperMenu } : {})}
          onAction={menuAction}
          onDismiss={closeContextMenu}
        />
      ) : null}

      <FileManagerDialogs
        fs={fs}
        {...(fsEvents ? { fsEvents } : {})}
        {...(associations ? { associations } : {})}
        {...(openService ? { openService } : {})}
        openWithNode={openWithNode}
        propertiesNode={propertiesNode}
        onCloseOpenWith={() => setOpenWithNode(null)}
        onCloseProperties={() => setPropertiesNode(null)}
        onChanged={() => void directory.refresh()}
      />
    </div>
  );
}