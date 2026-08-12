import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  callTool,
  loadTileContext,
  onAppStateChange,
  type MsgBusEndpointId,
} from "neutron-tools/app";
import type {
  Desired,
  Effort,
  ReviewAtomMeta,
  ReviewAtomState,
  ReviewItem,
  ReviewOperation,
  ReviewRevision,
  TestResult,
  WorkState,
} from "./model.ts";
import "./style.scss";

const STATE_TOPIC = "review.state";
const RESULTS: TestResult[] = ["not_tested", "working", "not_working", "needs_polish"];
const DESIRED: Desired[] = [null, "must", "high", "normal", "later"];
const EFFORT: Effort[] = [null, "tiny", "small", "medium", "big", "really_big"];
const WORK_STATES: WorkState[] = ["untriaged", "needs_design", "ready", "in_progress", "blocked", "needs_retest", "done", "deferred"];

export function App() {
  const context = useMemo(() => loadTileContext(), []);
  const target = `app:${context.app ?? "review"}:background` as MsgBusEndpointId;
  const [atoms, setAtoms] = useState<ReviewAtomMeta[]>([]);
  const [atom, setAtom] = useState<ReviewAtomState | null>(null);
  const [history, setHistory] = useState<ReviewRevision[]>([]);
  const [newTitle, setNewTitle] = useState("Untitled Review");
  const [importPath, setImportPath] = useState("/todo.md");
  const [exportPath, setExportPath] = useState("/review-export.md");
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshCatalog = useCallback(async (preferredAtomId?: string) => {
    const catalog = await call<{ atoms: ReviewAtomMeta[] }>(target, "review_catalog", {});
    setAtoms(catalog.atoms);
    const atomId = preferredAtomId ?? atom?.meta.atomId ?? catalog.atoms[0]?.atomId;
    if (!atomId) { setAtom(null); setHistory([]); return; }
    const next = await call<ReviewAtomState>(target, "review_atom", { atomId });
    const revisions = await call<{ revisions: ReviewRevision[] }>(target, "review_history", { atomId });
    setAtom(next);
    setHistory(revisions.revisions);
  }, [atom?.meta.atomId, target]);

  const refreshCurrent = useCallback(async () => {
    if (!atom) return refreshCatalog();
    const next = await call<ReviewAtomState>(target, "review_atom", { atomId: atom.meta.atomId });
    const revisions = await call<{ revisions: ReviewRevision[] }>(target, "review_history", { atomId: atom.meta.atomId });
    setAtom(next);
    setHistory(revisions.revisions);
    setAtoms((current) => current.map((entry) => entry.atomId === next.meta.atomId ? next.meta : entry));
  }, [atom, refreshCatalog, target]);

  useEffect(() => { void refreshCatalog().catch((cause) => setError(message(cause))); }, []);
  useEffect(() => onAppStateChange(STATE_TOPIC, () => { void refreshCatalog().catch(() => {}); }), [refreshCatalog]);

  const perform = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError(null); setNotice(null);
    try { await work(); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }, []);

  const createReview = () => perform(async () => {
    const result = await call<{ atomId: string }>(target, "review_create", { commandId: command("create"), title: newTitle.trim() || "Untitled Review" });
    await refreshCatalog(result.atomId);
    setNotice("Created a new logical Review Atom.");
  });

  const importReview = () => perform(async () => {
    const result = await call<{ atomId: string; importedItems: number }>(target, "review_file", { action: "import", commandId: command("import"), path: importPath.trim() });
    await refreshCatalog(result.atomId);
    setNotice(`Imported ${result.importedItems} item${result.importedItems === 1 ? "" : "s"}; source path remains provenance only.`);
  });

  const exportReview = () => perform(async () => {
    if (!atom) return;
    await call(target, "review_file", { action: "export", atomId: atom.meta.atomId, expectedRevision: atom.meta.currentRevision, path: exportPath.trim() });
    setNotice(`Exported revision ${short(atom.meta.currentRevision)} to ${exportPath.trim()}.`);
  });

  const apply = useCallback((operation: ReviewOperation) => perform(async () => {
    if (!atom) return;
    await call(target, "review_command", {
      atomId: atom.meta.atomId,
      expectedRevision: atom.meta.currentRevision,
      commandId: command(operation.type),
      operation,
    });
    await refreshCurrent();
  }), [atom, perform, refreshCurrent, target]);

  const addItem = () => {
    const title = newItem.trim();
    if (!title) return;
    void apply({ type: "review.create_item", title }).then(() => setNewItem(""));
  };

  return <main className="review-app">
    <header className="review-header">
      <div>
        <span className="eyebrow">Review.neutron</span>
        <h1>{atom?.meta.title ?? "Collaborative Review Atom"}</h1>
        <p>{atom ? `Atom ${short(atom.meta.atomId)} · revision ${atom.meta.currentSequence} (${short(atom.meta.currentRevision)})` : "One installation can own many logical review workspaces."}</p>
      </div>
      {atom?.meta.source && <div className="source-chip" title="Source is provenance, not Atom identity">Source: {atom.meta.source.path}</div>}
    </header>

    <section className="review-actions" aria-label="Review file and Atom actions">
      <label>New review <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></label>
      <button disabled={busy} onClick={createReview}>Create Atom</button>
      <label>File &gt; Open <input aria-label="Markdown or TODO path" value={importPath} onChange={(event) => setImportPath(event.target.value)} /></label>
      <button disabled={busy || !importPath.trim()} onClick={importReview}>Open Markdown/TODO</button>
      <label>Export <input aria-label="Export Markdown path" value={exportPath} onChange={(event) => setExportPath(event.target.value)} /></label>
      <button disabled={busy || !atom || !exportPath.trim()} onClick={exportReview}>Export Markdown</button>
    </section>

    {error && <div className="banner error" role="alert">{error}</div>}
    {notice && <div className="banner notice" role="status">{notice}</div>}

    <div className="review-layout">
      <aside className="atom-sidebar">
        <h2>Reviews</h2>
        {atoms.length === 0 && <p className="muted">No Review Atoms yet.</p>}
        {atoms.map((entry) => <button
          key={entry.atomId}
          className={entry.atomId === atom?.meta.atomId ? "atom-choice active" : "atom-choice"}
          onClick={() => void perform(async () => { await refreshCatalog(entry.atomId); })}
        >
          <strong>{entry.title}</strong>
          <span>r{entry.currentSequence} · {short(entry.atomId)}</span>
        </button>)}
      </aside>

      <section className="review-board" aria-label="Review items">
        {!atom && <div className="empty-state"><h2>Create or open a Review</h2><p>Review state is stored by this application's persistent provider; Markdown is import/export portability.</p></div>}
        {atom && <>
          <div className="add-item">
            <input aria-label="New review item" value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} placeholder="Add a review item…" />
            <button disabled={busy || !newItem.trim()} onClick={addItem}>Add item</button>
          </div>
          {atom.items.map((item) => <ReviewItemCard key={item.itemId} item={item} atom={atom} busy={busy} apply={apply} />)}
        </>}
      </section>

      <aside className="history-sidebar">
        <h2>History</h2>
        <p className="muted">Semantic application transactions only.</p>
        {[...history].reverse().map((revision) => <article key={revision.revisionId} className="history-entry">
          <strong>r{revision.sequence}</strong>
          <span>{revision.summary}</span>
          <small>{revision.actor.displayName ?? revision.actor.key}</small>
          {atom && revision.revisionId !== atom.meta.currentRevision && <button disabled={busy} onClick={() => void apply({ type: "history.restore", revisionId: revision.revisionId })}>Restore</button>}
        </article>)}
      </aside>
    </div>
  </main>;
}

function ReviewItemCard({ item, atom, busy, apply }: {
  item: ReviewItem;
  atom: ReviewAtomState;
  busy: boolean;
  apply: (operation: ReviewOperation) => Promise<void>;
}) {
  const localResult = item.results["human:local"]?.result ?? "not_tested";
  const [desired, setDesired] = useState<Desired>(item.coordination.desired);
  const [effort, setEffort] = useState<Effort>(item.coordination.effort);
  const [owner, setOwner] = useState(item.coordination.owner ?? "");
  const [workState, setWorkState] = useState<WorkState>(item.coordination.workState);
  const [comment, setComment] = useState("");
  useEffect(() => {
    setDesired(item.coordination.desired); setEffort(item.coordination.effort); setOwner(item.coordination.owner ?? ""); setWorkState(item.coordination.workState);
  }, [item.coordination.desired, item.coordination.effort, item.coordination.owner, item.coordination.workState]);
  const comments = atom.comments.filter((entry) => entry.itemId === item.itemId);

  return <article className="review-card" data-item-id={item.itemId}>
    <div className="item-heading"><div><span className="item-id">{short(item.itemId)}</span><h3>{item.title}</h3></div></div>
    {item.descriptionMarkdown && <p className="description">{item.descriptionMarkdown}</p>}

    <fieldset className="result-field"><legend>Your evidence</legend>
      {RESULTS.map((result) => <button key={result} disabled={busy} className={localResult === result ? `result active ${result}` : `result ${result}`} onClick={() => void apply({ type: "review.set_result", itemId: item.itemId, result })}>{label(result)}</button>)}
    </fieldset>

    <fieldset className="coordination"><legend>Coordination</legend>
      <label>Desired<select value={desired ?? ""} onChange={(event) => setDesired((event.target.value || null) as Desired)}>{DESIRED.map((value) => <option key={value ?? "unset"} value={value ?? ""}>{label(value ?? "unset")}</option>)}</select></label>
      <label>Effort<select value={effort ?? ""} onChange={(event) => setEffort((event.target.value || null) as Effort)}>{EFFORT.map((value) => <option key={value ?? "unset"} value={value ?? ""}>{label(value ?? "unset")}</option>)}</select></label>
      <label>Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="unassigned" /></label>
      <label>Work state<select value={workState} onChange={(event) => setWorkState(event.target.value as WorkState)}>{WORK_STATES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <button disabled={busy} onClick={() => void apply({ type: "review.set_coordination", itemId: item.itemId, patch: { desired, effort, owner: owner.trim() || null, workState } })}>Save coordination</button>
    </fieldset>

    <section className="comments"><h4>Comments</h4>
      {comments.map((entry) => <p key={entry.commentId}><strong>{entry.displayName ?? entry.actor}:</strong> {entry.body}</p>)}
      <div className="comment-entry"><input aria-label={`Comment on ${item.title}`} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment…" /><button disabled={busy || !comment.trim()} onClick={() => { const body = comment.trim(); setComment(""); void apply({ type: "comment.add", itemId: item.itemId, body }); }}>Comment</button></div>
    </section>
  </article>;
}

async function call<T = unknown>(target: MsgBusEndpointId, name: string, args: Record<string, unknown>): Promise<T> {
  return await callTool({ target, name, arguments: args as any }, 30) as T;
}

function command(prefix: string): string {
  return `${prefix}-${Date.now()}-${globalThis.crypto.randomUUID()}`.slice(0, 128);
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function short(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function message(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) return String((value as { message: unknown }).message);
  return String(value);
}

const root = document.getElementById("root");
if (!root) throw new Error("Review root element is missing");
createRoot(root).render(<App />);
