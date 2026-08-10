import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent as ReactChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type {
  AssociationRegistry,
  AtomDescriptor,
  FsEventSource,
  FsNode,
  FsService,
  HandlerDefinition,
  HandlerId,
  NodeId,
  OpenService,
} from "../contracts/index.ts";
import { OpenWithServiceModel } from "../associations/index.ts";
import {
  basenameSelectionRange,
  extensionOf,
  parentPath,
  readAssociationProbe,
  renameNode,
} from "./model.ts";

export interface PropertiesInspection {
  node: FsNode;
  path: string;
  location: string;
  extension: string | null;
  kindLabel: string;
  defaultHandler: HandlerDefinition | null;
  compatibleHandlers: readonly HandlerDefinition[];
  atom: AtomDescriptor | null;
  warnings: readonly string[];
}

export function friendlyKind(node: FsNode, atom: AtomDescriptor | null = null): string {
  if (atom) return `${atom.atomType} Atom`;
  if (node.kind === "directory") return "Folder";
  if (node.kind === "shortcut" || node.name.toLowerCase().endsWith(".url")) return "Internet shortcut";
  if (node.kind === "atom") return "Plasmon Atom";
  return node.mime ?? "File";
}

export async function inspectProperties(
  fs: FsService,
  registry: AssociationRegistry,
  nodeId: NodeId,
): Promise<PropertiesInspection> {
  const node = await fs.stat(nodeId);
  const path = await fs.pathOf(nodeId);
  const probe = await readAssociationProbe(fs, node);
  const openModel = node.kind === "directory"
    ? null
    : await new OpenWithServiceModel(registry, { open: async () => undefined }).model(node, probe);
  const compatibleHandlers = openModel?.candidates.map((candidate) => candidate.handler) ?? [];
  const defaultHandler = openModel?.defaultHandlerId
    ? compatibleHandlers.find((handler) => handler.id === openModel.defaultHandlerId) ?? null
    : null;
  const atom = openModel?.target.atom ?? null;
  return {
    node,
    path,
    location: parentPath(path),
    extension: extensionOf(node.name),
    kindLabel: friendlyKind(node, atom),
    defaultHandler,
    compatibleHandlers,
    atom,
    warnings: openModel?.warnings ?? [],
  };
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

export interface OpenWithPanelProps {
  fs: FsService;
  node: FsNode;
  registry: AssociationRegistry;
  openService: OpenService;
  onClose: () => void;
  onChanged?: () => void;
}

export function OpenWithPanel({
  fs,
  node,
  registry,
  openService,
  onClose,
  onChanged,
}: OpenWithPanelProps) {
  const service = useMemo(() => new OpenWithServiceModel(registry, openService), [registry, openService]);
  const [model, setModel] = useState<Awaited<ReturnType<OpenWithServiceModel["model"]>> | null>(null);
  const [selected, setSelected] = useState<HandlerId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const current = await fs.stat(node.id);
      const probe = await readAssociationProbe(fs, current);
      const next = await service.model(current, probe);
      setModel(next);
      setSelected((value) => value && next.candidates.some((entry) => entry.handler.id === value)
        ? value
        : next.defaultHandlerId ?? next.candidates[0]?.handler.id ?? null);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [fs, node.id, service]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (action: "open" | "default") => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const current = await fs.stat(node.id);
      const probe = await readAssociationProbe(fs, current);
      if (action === "open") {
        await service.open(current, selected, probe);
        onClose();
      } else {
        await service.setDefault(current, selected, probe);
        await refresh();
        onChanged?.();
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fm-modal-backdrop" role="presentation" onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="fm-dialog" role="dialog" aria-modal="true" aria-labelledby="fm-open-with-title">
        <header className="fm-dialog__header">
          <h2 id="fm-open-with-title">Open with</h2>
          <button type="button" className="fm-icon-button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <p className="fm-dialog__lede">Choose an application for <strong>{node.name}</strong>.</p>
        {error ? <p className="fm-error" role="alert">{error}</p> : null}
        {!model ? <p>Loading applications…</p> : model.candidates.length === 0 ? (
          <p>No compatible applications are registered.</p>
        ) : (
          <div className="fm-handler-list" role="radiogroup" aria-label="Compatible applications">
            {model.candidates.map(({ handler, isDefault }) => (
              <label className="fm-handler" key={handler.id}>
                <input
                  type="radio"
                  name="open-with"
                  value={handler.id}
                  checked={selected === handler.id}
                  onChange={() => setSelected(handler.id)}
                />
                <span className="fm-handler__icon" aria-hidden="true">{handler.kind === "neutron" ? "⚛" : "◆"}</span>
                <span>
                  <strong>{handler.name}</strong>
                  <small>{isDefault ? "Current default" : handler.id}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        {model?.warnings.map((warning) => <p className="fm-warning" key={warning}>{warning}</p>)}
        <footer className="fm-dialog__actions">
          <button type="button" onClick={() => void run("default")} disabled={busy || !selected}>Set Default</button>
          <button type="button" className="fm-primary" onClick={() => void run("open")} disabled={busy || !selected}>Open</button>
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        </footer>
      </section>
    </div>
  );
}

export interface PropertiesPanelProps {
  nodeId: NodeId;
  fs: FsService;
  fsEvents?: FsEventSource;
  registry: AssociationRegistry;
  openService: OpenService;
  onClose?: () => void;
}

export function PropertiesPanel({ nodeId, fs, fsEvents, registry, openService, onClose }: PropertiesPanelProps) {
  const [inspection, setInspection] = useState<PropertiesInspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [openWith, setOpenWith] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await inspectProperties(fs, registry, nodeId);
      setInspection(next);
      if (!editing) setName(next.node.name);
      setError(null);
    } catch (cause: unknown) {
      setInspection(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [editing, fs, nodeId, registry]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!fsEvents) return undefined;
    return fsEvents.subscribe((event) => {
      if (event.type === "reset" || event.type === "removed" && event.id === nodeId || "node" in event && event.node.id === nodeId) {
        void refresh();
      }
    });
  }, [fsEvents, nodeId, refresh]);

  useEffect(() => {
    if (!editing || !nameRef.current) return;
    nameRef.current.focus();
    const [start, end] = basenameSelectionRange(name);
    nameRef.current.setSelectionRange(start, end);
  }, [editing, name]);

  const commitRename = async () => {
    if (!inspection) return;
    try {
      await renameNode(fs, inspection.node.id, name);
      setEditing(false);
      setRenameError(null);
      await refresh();
    } catch (cause: unknown) {
      setRenameError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (error) {
    return <section className="fm-properties"><p role="alert" className="fm-error">{error}</p><button type="button" onClick={() => void refresh()}>Retry</button></section>;
  }
  if (!inspection) return <section className="fm-properties"><p>Loading properties…</p></section>;

  const { node } = inspection;
  return (
    <section className="fm-properties" aria-label={`Properties for ${node.name}`}>
      <header className="fm-properties__hero">
        <div className={`fm-kind-icon fm-kind-icon--${node.kind}`} aria-hidden="true">
          {node.kind === "directory" ? "▰" : node.kind === "atom" ? "◈" : node.kind === "shortcut" ? "↗" : "□"}
        </div>
        <div className="fm-properties__name">
          {editing ? (
            <>
              <input
                ref={nameRef}
                value={name}
                aria-label="Name"
                onChange={(event: ReactChangeEvent<HTMLInputElement>) => { setName(event.target.value); setRenameError(null); }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter") { event.preventDefault(); void commitRename(); }
                  if (event.key === "Escape") { event.preventDefault(); setName(node.name); setEditing(false); setRenameError(null); }
                }}
              />
              {renameError ? <span className="fm-inline-error" role="alert">{renameError}</span> : null}
            </>
          ) : (
            <button type="button" className="fm-name-button" onClick={() => setEditing(true)} title="Rename">{node.name}</button>
          )}
        </div>
        {onClose ? <button type="button" className="fm-icon-button" aria-label="Close properties" onClick={onClose}>×</button> : null}
      </header>

      <dl className="fm-properties__grid">
        <dt>Type</dt><dd>{inspection.kindLabel}</dd>
        <dt>Extension</dt><dd>{inspection.extension ?? "—"}</dd>
        <dt>Opens with</dt>
        <dd className="fm-properties__opens-with">
          <span>{inspection.defaultHandler?.name ?? (node.kind === "directory" ? "File Explorer" : "No default application")}</span>
          {node.kind !== "directory" ? <button type="button" onClick={() => setOpenWith(true)}>Change…</button> : null}
        </dd>
        {inspection.atom ? <><dt>Atom type</dt><dd>{inspection.atom.atomType}</dd><dt>Atom ID</dt><dd className="fm-monospace">{inspection.atom.atomId}</dd></> : null}
        <dt>Location</dt><dd className="fm-monospace">{inspection.location}</dd>
        <dt>Path</dt><dd className="fm-monospace">{inspection.path}</dd>
        <dt>Size</dt><dd>{formatBytes(node.size)}</dd>
        <dt>Created</dt><dd>{formatTimestamp(node.createdAt)}</dd>
        <dt>Modified</dt><dd>{formatTimestamp(node.modifiedAt)}</dd>
        <dt>Content hash</dt><dd className="fm-monospace fm-properties__hash">{node.contentHash ?? "—"}</dd>
      </dl>
      {inspection.warnings.map((warning) => <p className="fm-warning" key={warning}>{warning}</p>)}
      {openWith ? (
        <OpenWithPanel
          fs={fs}
          node={node}
          registry={registry}
          openService={openService}
          onClose={() => setOpenWith(false)}
          onChanged={() => void refresh()}
        />
      ) : null}
    </section>
  );
}
