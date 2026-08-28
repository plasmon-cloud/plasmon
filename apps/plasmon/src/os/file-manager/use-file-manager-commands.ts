import {
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import { activateFileManagerNode, type FileManagerOpenAuthority } from "./activation.ts";
import { pasteClipboardCollisionAware } from "./clipboard.ts";
import {
  createDocument,
  createGeneratedFolder,
  importFileIntoFs,
  type NewDocumentKind,
} from "./create-import.ts";
import {
  createFileManagerShortcut,
  fileManagerShortcutTarget,
  sendFileManagerShortcutToDesktop,
} from "./create-shortcut.ts";
import {
  deleteFailureMessage,
  deleteFilesystemNodes,
  type FileManagerTrashAuthority,
} from "./delete.ts";
import { downloadBlob, readDownloadBlob } from "./download.ts";
import { fileManagerErrorMessage } from "./error-message.ts";
import {
  FileOperationClipboard,
  clearSelection,
  type SelectionState,
} from "./model.ts";
import { FileOperationState } from "./operation-state.ts";

interface UseFileManagerCommandsOptions {
  directoryId: NodeId;
  fs: FsService;
  openAuthority: FileManagerOpenAuthority;
  trashAuthority: FileManagerTrashAuthority;
  clipboard: FileOperationClipboard;
  operationState: FileOperationState;
  nodes: readonly FsNode[];
  selection: SelectionState;
  setSelection: Dispatch<SetStateAction<SelectionState>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refresh: () => Promise<void>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  beginInlineRename: (node: FsNode) => void;
  closeContextMenu: () => void;
  onOpenDirectory?: (node: FsNode) => void | Promise<void>;
  confirmDelete?: (nodes: readonly FsNode[]) => boolean | Promise<boolean>;
}

function downloadSignature(node: FsNode): string {
  return [node.id, node.name, node.mime ?? "", node.size, node.modifiedAt, node.contentHash ?? ""].join("\0");
}

export function useFileManagerCommands(options: UseFileManagerCommandsOptions) {
  const {
    directoryId,
    fs,
    openAuthority,
    trashAuthority,
    clipboard,
    operationState,
    nodes,
    selection,
    setSelection,
    setError,
    refresh,
    fileInputRef,
    beginInlineRename,
    closeContextMenu,
    onOpenDirectory,
    confirmDelete,
  } = options;

  const selectedNodes = () => {
    const ids = selection.ids;
    return nodes.filter((node) => ids.has(node.id));
  };

  const downloadPreparationRef = useRef<{
    signature: string;
    promise: Promise<Blob>;
  } | null>(null);
  const [preparedDownload, setPreparedDownload] = useState<{
    signature: string;
    blob: Blob;
  } | null>(null);
  const preparedDownloadRef = useRef<{
    signature: string;
    blob: Blob;
  } | null>(null);

  const prepareDownload = (node: FsNode) => {
    if (node.kind !== "file") return;
    const signature = downloadSignature(node);
    if (downloadPreparationRef.current?.signature === signature) return;
    preparedDownloadRef.current = null;
    setPreparedDownload(null);
    const promise = readDownloadBlob(fs, node);
    downloadPreparationRef.current = { signature, promise };
    void promise.then((blob) => {
      if (downloadPreparationRef.current?.promise !== promise) return;
      const prepared = { signature, blob };
      preparedDownloadRef.current = prepared;
      setPreparedDownload(prepared);
    }).catch((cause: unknown) => {
      if (downloadPreparationRef.current?.promise !== promise) return;
      downloadPreparationRef.current = null;
      setPreparedDownload(null);
      setError(fileManagerErrorMessage(cause));
    });
  };

  const isDownloadReady = (node: FsNode) =>
    node.kind === "file" && preparedDownload?.signature === downloadSignature(node);

  const openNode = async (node: FsNode) => {
    closeContextMenu();
    try {
      await activateFileManagerNode(
        openAuthority,
        node,
        onOpenDirectory ? { onOpenDirectory } : {},
      );
      setError(null);
    } catch (cause: unknown) {
      setError(fileManagerErrorMessage(cause));
    }
  };

  const createNewFolder = async () => {
    closeContextMenu();
    try {
      const created = await createGeneratedFolder(fs, directoryId);
      setError(null);
      await refresh();
      setSelection({ ids: new Set([created.id]), anchor: created.id, focus: created.id });
      beginInlineRename(created);
    } catch (cause: unknown) {
      setError(fileManagerErrorMessage(cause));
    }
  };

  const removeNodes = async (items: readonly FsNode[]) => {
    if (items.length === 0) return;
    const permitted = confirmDelete ? await confirmDelete(items) : true;
    if (!permitted) return;
    try {
      const result = await deleteFilesystemNodes(trashAuthority, items);
      if (result.failures.length === 0) setSelection(clearSelection());
      closeContextMenu();
      await refresh();
      const failure = deleteFailureMessage(result.failures);
      if (failure) setError(failure);
    } catch (cause: unknown) {
      await refresh();
      setError(fileManagerErrorMessage(cause));
    }
  };

  const removeSelected = async () => removeNodes(selectedNodes());

  const copySelection = (ids: Iterable<NodeId> = selection.ids) => {
    clipboard.copy(ids);
    setError(null);
  };

  const cutSelection = (ids: Iterable<NodeId> = selection.ids) => {
    clipboard.cut(ids);
    setError(null);
  };

  const paste = async () => {
    const snapshot = clipboard.snapshot();
    if (
      !snapshot ||
      snapshot.ids.length === 0 ||
      !operationState.begin("paste", snapshot.ids.length)
    ) return;

    try {
      const pasted = await pasteClipboardCollisionAware(fs, directoryId, clipboard);
      operationState.completeKnownItems(pasted.length);
      operationState.complete();
      setError(null);
      await refresh();
    } catch (cause: unknown) {
      if (operationState.isRunning()) {
        operationState.fail(fileManagerErrorMessage(cause));
      }
      setError(fileManagerErrorMessage(cause));
    }
  };

  const createNewDocument = async (kind: NewDocumentKind) => {
    closeContextMenu();
    try {
      const created = await createDocument(fs, directoryId, kind);
      setError(null);
      await refresh();
      setSelection({ ids: new Set([created.id]), anchor: created.id, focus: created.id });
      beginInlineRename(created);
    } catch (cause: unknown) {
      setError(fileManagerErrorMessage(cause));
    }
  };

  const createShortcutFromSelection = async () => {
    const target = fileManagerShortcutTarget(nodes, selection.ids);
    if (!target) return;
    closeContextMenu();
    try {
      const result = await createFileManagerShortcut(fs, directoryId, target);
      setError(null);
      await refresh();
      setSelection(result.selection);
      beginInlineRename(result.shortcut);
    } catch (cause: unknown) {
      setError(fileManagerErrorMessage(cause));
    }
  };

  const sendSelectionToDesktop = async () => {
    const target = fileManagerShortcutTarget(nodes, selection.ids);
    if (!target) return;
    closeContextMenu();
    try {
      await sendFileManagerShortcutToDesktop(fs, target);
      setError(null);
    } catch (cause: unknown) {
      setError(fileManagerErrorMessage(cause));
    }
  };

  const importFiles = async (files: readonly File[]) => {
    if (files.length === 0 || !operationState.begin("import", files.length)) return;
    closeContextMenu();
    const imported: FsNode[] = [];
    const failures: string[] = [];

    for (const [index, file] of files.entries()) {
      operationState.startItem(index + 1, file.name);
      try {
        imported.push(await importFileIntoFs(fs, directoryId, file));
        operationState.succeedItem();
      } catch (cause: unknown) {
        const message = fileManagerErrorMessage(cause);
        failures.push(`${file.name}: ${message}`);
        operationState.failItem(file.name, message);
      }
    }

    operationState.complete();
    await refresh();
    if (imported.length > 0) {
      const ids = imported.map((node) => node.id);
      setSelection({
        ids: new Set(ids),
        anchor: ids[0] ?? null,
        focus: ids.at(-1) ?? null,
      });
    }
    setError(failures.length > 0 ? `Import failed — ${failures.join("; ")}` : null);
  };

  const triggerImport = () => {
    if (operationState.isRunning()) return;
    closeContextMenu();
    fileInputRef.current?.click();
  };

  const downloadNode = async (node: FsNode) => {
    closeContextMenu();
    try {
      const signature = downloadSignature(node);
      const prepared = preparedDownloadRef.current?.signature === signature
        ? preparedDownloadRef.current.blob
        : preparedDownload?.signature === signature
          ? preparedDownload.blob
          : await readDownloadBlob(fs, node);
      // Keep this call synchronous when preparation completed before the user
      // click; Chromium otherwise drops transient user activation at the first
      // asynchronous filesystem read.
      downloadBlob(node, prepared);
      downloadPreparationRef.current = null;
      preparedDownloadRef.current = null;
      setPreparedDownload(null);
      setError(null);
    } catch (cause: unknown) {
      setError(fileManagerErrorMessage(cause));
    }
  };

  return {
    canCreateShortcut: fileManagerShortcutTarget(nodes, selection.ids) !== null,
    selectedNodes,
    openNode,
    createNewFolder,
    removeNodes,
    removeSelected,
    copySelection,
    cutSelection,
    paste,
    createNewDocument,
    createShortcutFromSelection,
    sendSelectionToDesktop,
    importFiles,
    triggerImport,
    prepareDownload,
    isDownloadReady,
    downloadNode,
  };
}
