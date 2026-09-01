import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type {
  FsEventSource,
  FsService,
  NodeId,
  OpenTarget,
  ProcessController,
  ProcessId,
} from "../../os/contracts/index.ts";
import type { FilesystemTrashService } from "../../os/fs/index.ts";
import {
  reportRecycleBinRefreshAfterDeleteFailure,
  reportRecycleBinRefreshAfterRestoreFailure,
} from "../semanticDiagnostics.ts";
import {
  RecycleBinModel,
  recycleBinKindLabel,
  subscribeRecycleBinInvalidation,
  type RecycleBinItem,
} from "./model.ts";
import "./recycle-bin.scss";

export interface RecycleBinProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
  trash: FilesystemTrashService;
  fsEvents?: FsEventSource;
  /** Deterministic adapter seam; installed Plasmon uses the in-app confirmation UI. */
  confirmAction?: (message: string) => boolean;
}

type BusyAction = "restore" | "delete" | "empty" | null;
type ConfirmationRequest =
  | { action: "delete"; ids: NodeId[]; message: string }
  | { action: "empty"; message: string };

function countLabel(count: number, noun = "item"): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatDeletedAt(value: number): string {
  if (!Number.isFinite(value)) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unit: (typeof units)[number] = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index]!;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function RecycleBin({
  processId,
  process,
  trash,
  fsEvents,
  confirmAction,
}: RecycleBinProps) {
  const model = useMemo(() => new RecycleBinModel(trash), [trash]);
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [selected, setSelected] = useState<Set<NodeId>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  useEffect(() => {
    process.setTitle(processId, "Recycle Bin");
  }, [process, processId]);

  const refresh = useCallback(async (showLoading = false): Promise<boolean> => {
    const generation = ++refreshGeneration.current;
    if (showLoading) setLoading(true);
    try {
      const next = await model.list();
      if (generation !== refreshGeneration.current) return true;
      setItems(next);
      const available = new Set(next.map((item) => item.id));
      setSelected((current) => new Set([...current].filter((id) => available.has(id))));
      setError(null);
      return true;
    } catch (cause: unknown) {
      if (generation === refreshGeneration.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      return false;
    } finally {
      if (showLoading && generation === refreshGeneration.current) setLoading(false);
    }
  }, [model]);

  useEffect(() => {
    void refresh(true);
    return () => { refreshGeneration.current += 1; };
  }, [refresh]);

  useEffect(
    () => subscribeRecycleBinInvalidation(fsEvents, () => { void refresh(false); }),
    [fsEvents, refresh],
  );

  const selectedIds = useMemo(
    () => items.filter((item) => selected.has(item.id)).map((item) => item.id),
    [items, selected],
  );
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const controlsDisabled = busy !== null || loading || confirmation !== null;

  const toggleItem = (id: NodeId, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(items.map((item) => item.id)) : new Set());
  };

  const restoreSelected = async () => {
    if (selectedIds.length === 0 || controlsDisabled) return;
    setBusy("restore");
    setError(null);
    setNotice(null);
    try {
      const results = await model.restore(selectedIds);
      const fallbackCount = results.filter((result) => result.usedFallback).length;
      const renamedCount = results.filter((result) => result.renamed).length;
      const details = [
        fallbackCount ? `${countLabel(fallbackCount)} used the Desktop fallback` : "",
        renamedCount ? `${countLabel(renamedCount)} renamed to avoid a collision` : "",
      ].filter(Boolean);
      setNotice(`Restored ${countLabel(results.length)}${details.length ? `. ${details.join("; ")}.` : "."}`);
      setSelected(new Set());
      if (!await refresh(false)) reportRecycleBinRefreshAfterRestoreFailure();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const permanentlyDeleteConfirmed = async (ids: NodeId[]) => {
    setBusy("delete");
    setError(null);
    setNotice(null);
    try {
      const removed = await model.permanentlyDelete(ids);
      setNotice(`Permanently deleted ${countLabel(removed)}.`);
      setSelected(new Set());
      if (!await refresh(false)) reportRecycleBinRefreshAfterDeleteFailure();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0 || controlsDisabled) return;
    const ids = [...selectedIds];
    const message = `Permanently delete ${countLabel(ids.length)}? This cannot be undone.`;
    if (confirmAction) {
      if (confirmAction(message)) void permanentlyDeleteConfirmed(ids);
      return;
    }
    setConfirmation({ action: "delete", ids, message });
  };

  const emptyConfirmed = async () => {
    setBusy("empty");
    setError(null);
    setNotice(null);
    try {
      const removed = await model.empty();
      setNotice(`Recycle Bin emptied. Permanently deleted ${countLabel(removed)}.`);
      setSelected(new Set());
      if (!await refresh(false)) reportRecycleBinRefreshAfterDeleteFailure();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const emptyRecycleBin = () => {
    if (items.length === 0 || controlsDisabled) return;
    const message = `Permanently delete all ${countLabel(items.length)} in Recycle Bin? This cannot be undone.`;
    if (confirmAction) {
      if (confirmAction(message)) void emptyConfirmed();
      return;
    }
    setConfirmation({ action: "empty", message });
  };

  const confirmPendingAction = () => {
    const pending = confirmation;
    if (!pending || busy !== null || loading) return;
    setConfirmation(null);
    if (pending.action === "empty") void emptyConfirmed();
    else void permanentlyDeleteConfirmed(pending.ids);
  };

  return (
    <section className="recycle-bin" aria-label="Recycle Bin">
      <header className="recycle-bin__header">
        <div>
          <span className="recycle-bin__eyebrow">System</span>
          <h1>Recycle Bin</h1>
          <p>{loading ? "Loading deleted items…" : `${countLabel(items.length)} in Recycle Bin`}</p>
        </div>
        <button
          type="button"
          className="recycle-bin__danger-button"
          disabled={controlsDisabled || items.length === 0}
          onClick={emptyRecycleBin}
        >
          {busy === "empty" ? "Emptying…" : "Empty Recycle Bin"}
        </button>
      </header>

      <div className="recycle-bin__toolbar" role="toolbar" aria-label="Recycle Bin actions">
        <button
          type="button"
          disabled={controlsDisabled || selectedIds.length === 0}
          onClick={() => { void restoreSelected(); }}
        >
          {busy === "restore" ? "Restoring…" : `Restore${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
        </button>
        <button
          type="button"
          className="recycle-bin__danger-button"
          disabled={controlsDisabled || selectedIds.length === 0}
          onClick={deleteSelected}
        >
          {busy === "delete" ? "Deleting…" : `Delete permanently${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
        </button>
        <span className="recycle-bin__toolbar-spacer" />
        <button type="button" disabled={controlsDisabled} onClick={() => { void refresh(true); }}>Refresh</button>
      </div>

      {error ? <div className="recycle-bin__banner recycle-bin__banner--error" role="alert">{error}</div> : null}
      {notice ? <div className="recycle-bin__banner" role="status">{notice}</div> : null}

      <div className="recycle-bin__content" aria-busy={loading || busy !== null}>
        {loading ? (
          <div className="recycle-bin__state" role="status">Loading Recycle Bin…</div>
        ) : items.length === 0 ? (
          <div className="recycle-bin__state">
            <strong>Recycle Bin is empty.</strong>
            <span>Items moved here can be restored until they are permanently deleted.</span>
          </div>
        ) : (
          <div className="recycle-bin__table" role="table" aria-label="Deleted items">
            <div className="recycle-bin__row recycle-bin__row--header" role="row">
              <span role="columnheader" className="recycle-bin__select-cell">
                <input
                  type="checkbox"
                  aria-label="Select all deleted items"
                  checked={allSelected}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => toggleAll(event.currentTarget.checked)}
                />
              </span>
              <span role="columnheader">Name</span>
              <span role="columnheader">Original location</span>
              <span role="columnheader">Deleted</span>
              <span role="columnheader">Size</span>
            </div>
            {items.map((item) => {
              const checked = selected.has(item.id);
              return (
                <label key={item.id} className={`recycle-bin__row${checked ? " is-selected" : ""}`} role="row">
                  <span role="cell" className="recycle-bin__select-cell">
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.name}`}
                      checked={checked}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => toggleItem(item.id, event.currentTarget.checked)}
                    />
                  </span>
                  <span role="cell" className="recycle-bin__name-cell"><strong>{item.name}</strong><small>{recycleBinKindLabel(item.kind)}</small></span>
                  <span role="cell" title={item.originalPath}>{item.originalPath}</span>
                  <span role="cell">{formatDeletedAt(item.deletedAt)}</span>
                  <span role="cell">{formatSize(item.size)}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {confirmation ? (
        <div className="recycle-bin__confirmation-backdrop">
          <div
            className="recycle-bin__confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="recycle-bin-confirmation-title"
            aria-describedby="recycle-bin-confirmation-message"
          >
            <h2 id="recycle-bin-confirmation-title">
              {confirmation.action === "empty" ? "Empty Recycle Bin?" : "Delete permanently?"}
            </h2>
            <p id="recycle-bin-confirmation-message">{confirmation.message}</p>
            <div className="recycle-bin__confirmation-actions">
              <button type="button" onClick={() => setConfirmation(null)}>Cancel</button>
              <button
                type="button"
                className="recycle-bin__danger-button"
                onClick={confirmPendingAction}
              >
                {confirmation.action === "empty" ? "Confirm Empty Recycle Bin" : "Confirm permanent delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default RecycleBin;
