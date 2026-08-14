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
  WorkState,
} from "./model.ts";
import {
  DESIRED_OPTIONS,
  EFFORT_OPTIONS,
  RESULT_OPTIONS,
  WORK_STATE_OPTIONS,
  createReviewDetailsDraft,
  formatReviewTime,
  hasUnsavedReviewDetails,
} from "./presentation.ts";
import "./style.scss";

const STATE_TOPIC = "review.state";

export function App() {
  const context = useMemo(() => loadTileContext(), []);
  const target = `app:${context.app ?? "review"}:background` as MsgBusEndpointId;
  const [atoms, setAtoms] = useState<ReviewAtomMeta[]>([]);
  const [atom, setAtom] = useState<ReviewAtomState | null>(null);
  const [history, setHistory] = useState<ReviewRevision[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [importPath, setImportPath] = useState("/todo.md");
  const [exportPath, setExportPath] = useState("/review-export.md");
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [dirtyItems, setDirtyItems] = useState<Set<string>>(() => new Set());
  const [restoreRevision, setRestoreRevision] = useState<ReviewRevision | null>(null);

  const refreshCatalog = useCallback(async (preferredAtomId?: string) => {
    const catalog = await call<{ atoms: ReviewAtomMeta[] }>(target, "review_catalog", {});
    setAtoms(catalog.atoms);
    const atomId = preferredAtomId ?? atom?.meta.atomId ?? catalog.atoms[0]?.atomId;
    if (!atomId) {
      setAtom(null);
      setHistory([]);
      return;
    }
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

  useEffect(() => {
    void refreshCatalog()
      .catch((cause) => setError(message(cause)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => onAppStateChange(STATE_TOPIC, () => { void refreshCatalog().catch(() => {}); }), [refreshCatalog]);
  useEffect(() => {
    setDirtyItems(new Set());
    setRestoreRevision(null);
    if (atom) setLastSavedAt(atom.meta.updatedAt);
  }, [atom?.meta.atomId]);

  const perform = useCallback(async (work: () => Promise<void>, options: { persisted?: boolean } = {}) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (options.persisted) setLastSavedAt(Date.now());
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  const createReview = () => perform(async () => {
    const title = newTitle.trim() || "Untitled Review";
    const result = await call<{ atomId: string }>(target, "review_create", { commandId: command("create"), title });
    await refreshCatalog(result.atomId);
    setNewTitle("");
    setNotice("Review created. Completed actions are stored by Review automatically.");
  }, { persisted: true });

  const importReview = () => perform(async () => {
    const result = await call<{ atomId: string; importedItems: number }>(target, "review_file", { action: "import", commandId: command("import"), path: importPath.trim() });
    await refreshCatalog(result.atomId);
    setNotice(`Imported ${result.importedItems} item${result.importedItems === 1 ? "" : "s"} into a new Review. The source file is provenance, not the Review identity.`);
  }, { persisted: true });

  const exportReview = () => perform(async () => {
    if (!atom) return;
    await call(target, "review_file", { action: "export", atomId: atom.meta.atomId, expectedRevision: atom.meta.currentRevision, path: exportPath.trim() });
    setNotice(`Exported the current Review to ${exportPath.trim()}. This is a portable copy, not a live share.`);
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
  }, { persisted: true }), [atom, perform, refreshCurrent, target]);

  const addItem = () => {
    const title = newItem.trim();
    if (!title) return;
    void apply({ type: "review.create_item", title }).then(() => setNewItem(""));
  };

  const onDirtyChange = useCallback((itemId: string, dirty: boolean) => {
    setDirtyItems((current) => {
      const next = new Set(current);
      if (dirty) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const saveTitle = persistenceTitle({ atom, busy, error, dirtyCount: dirtyItems.size });
  const saveDescription = persistenceDescription({ atom, busy, error, dirtyCount: dirtyItems.size, lastSavedAt });

  return <main className="review-app">
    <header className="review-header">
      <div className="review-identity">
        <span className="eyebrow">Review</span>
        <h1>{atom?.meta.title ?? "Structured reviews without the guesswork"}</h1>
        <p>{atom ? "Track the desired outcome, effort, ownership, work, evidence, and history in one durable Review." : "Turn an outcome into clear work, evidence, and durable history."}</p>
        {atom?.meta.source && <div className="source-chip" title="Imported source is provenance, not Review identity">Imported from {atom.meta.source.path}</div>}
      </div>
      <div className="header-status">
        <div className={`persistence-status ${error ? "is-error" : dirtyItems.size ? "is-warning" : "is-saved"}`} role="status" aria-live="polite" data-testid="persistence-status">
          <span className="status-mark" aria-hidden="true" />
          <div>
            <strong>{saveTitle}</strong>
            <span>{saveDescription}</span>
          </div>
        </div>
        {atom && <details className="atom-details">
          <summary>Review details</summary>
          <dl>
            <div><dt>Atom identity</dt><dd>{atom.meta.atomId}</dd></div>
            <div><dt>Current revision</dt><dd>r{atom.meta.currentSequence} · {atom.meta.currentRevision}</dd></div>
            <div><dt>Created</dt><dd>{formatReviewTime(atom.meta.createdAt)}</dd></div>
          </dl>
        </details>}
      </div>
    </header>

    {error && <div className="banner error" role="alert"><strong>Action failed.</strong><span>{error}</span></div>}
    {notice && <div className="banner notice" role="status"><strong>Done.</strong><span>{notice}</span></div>}

    <div className="review-shell">
      <aside className="review-nav" aria-label="Review workspaces">
        <section className="nav-section create-review-panel">
          <div className="section-heading">
            <div><span className="section-kicker">Workspace</span><h2>New review</h2></div>
          </div>
          <p className="section-help">Create a durable Review Atom for one outcome or decision.</p>
          <label className="control-label" htmlFor="new-review-title">Review name</label>
          <input id="new-review-title" aria-label="New review" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !busy) void createReview(); }} placeholder="e.g. First demo readiness" />
          <button className="primary-button full-width" type="button" disabled={busy} onClick={() => void createReview()}>Create review</button>
        </section>

        <section className="nav-section review-list-panel">
          <div className="section-heading">
            <div><span className="section-kicker">Your work</span><h2>Reviews</h2></div>
            <span className="count-badge" aria-label={`${atoms.length} reviews`}>{atoms.length}</span>
          </div>
          {loading && <p className="muted">Loading Reviews…</p>}
          {!loading && atoms.length === 0 && <p className="muted">No Reviews yet. Create one above to begin.</p>}
          <div className="atom-list">
            {atoms.map((entry) => <button
              type="button"
              key={entry.atomId}
              className={entry.atomId === atom?.meta.atomId ? "atom-choice active" : "atom-choice"}
              aria-current={entry.atomId === atom?.meta.atomId ? "page" : undefined}
              disabled={busy}
              onClick={() => void perform(async () => { await refreshCatalog(entry.atomId); })}
            >
              <strong>{entry.title}</strong>
              <span>Updated {formatReviewTime(entry.updatedAt)} · r{entry.currentSequence}</span>
            </button>)}
          </div>
        </section>
      </aside>

      <section className="review-workspace" aria-label="Current Review workspace">
        {!loading && !atom && <FirstRunState />}
        {loading && <div className="workspace-empty"><span className="section-kicker">Review</span><h2>Opening your Reviews…</h2><p>Review is loading durable state from its provider.</p></div>}
        {atom && <>
          <div className="workspace-heading">
            <div>
              <span className="section-kicker">Current Review</span>
              <h2>{atom.meta.title}</h2>
              <p>{atom.items.length === 0 ? "Add the first item to define what should be true." : `${atom.items.length} review item${atom.items.length === 1 ? "" : "s"} · current revision r${atom.meta.currentSequence}`}</p>
            </div>
          </div>

          <div className="add-item-panel">
            <div>
              <label className="control-label" htmlFor="new-review-item">Add a review item</label>
              <p>Describe the outcome or condition you want to review.</p>
            </div>
            <div className="inline-control">
              <input id="new-review-item" aria-label="New review item" value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} placeholder="What should be true?" />
              <button className="primary-button" type="button" disabled={busy || !newItem.trim()} onClick={addItem}>Add item</button>
            </div>
          </div>

          {atom.items.length === 0 && <div className="workspace-empty compact">
            <span className="section-kicker">Start here</span>
            <h3>Add the first review item</h3>
            <p>Each item keeps four planning fields together with independent evidence and comments.</p>
            <div className="field-guide">
              <div><strong>Desired</strong><span>How strongly this outcome needs to be true.</span></div>
              <div><strong>Effort</strong><span>The expected size of the work.</span></div>
              <div><strong>Owner</strong><span>The person or team responsible for moving it.</span></div>
              <div><strong>Work</strong><span>Where the item is in the workflow right now.</span></div>
            </div>
          </div>}

          <div className="review-items">
            {atom.items.map((item) => <ReviewItemCard key={item.itemId} item={item} atom={atom} busy={busy} apply={apply} onDirtyChange={onDirtyChange} />)}
          </div>
        </>}
      </section>

      <aside className="review-inspector" aria-label="Review activity and tools">
        <section className="side-panel sharing-panel" data-testid="sharing-status">
          <div className="section-heading"><div><span className="section-kicker">Sharing</span><h2>Availability</h2></div></div>
          <div className="availability-row">
            <span className="availability-icon" aria-hidden="true">—</span>
            <div><strong>Live sharing isn’t available in this build</strong><span>MTN-backed shared access is intentionally deferred. No live link or collaborator access is being implied here.</span></div>
          </div>
        </section>

        <section className="side-panel portability-panel">
          <div className="section-heading"><div><span className="section-kicker">Files</span><h2>Import &amp; export</h2></div></div>
          <p className="section-help">Import creates a new Review. Export writes a portable Markdown copy; it is not live sharing.</p>
          <label className="control-label" htmlFor="review-import-path">Open Markdown / TODO</label>
          <input id="review-import-path" aria-label="Markdown or TODO path" value={importPath} onChange={(event) => setImportPath(event.target.value)} />
          <button className="secondary-button full-width" type="button" disabled={busy || !importPath.trim()} onClick={() => void importReview()}>Import as new Review</button>
          <div className="panel-divider" />
          <label className="control-label" htmlFor="review-export-path">Export current Review</label>
          <input id="review-export-path" aria-label="Export Markdown path" value={exportPath} onChange={(event) => setExportPath(event.target.value)} />
          <button className="secondary-button full-width" type="button" disabled={busy || !atom || !exportPath.trim()} onClick={() => void exportReview()}>Export Markdown copy</button>
        </section>

        <section className="side-panel history-panel">
          <div className="section-heading">
            <div><span className="section-kicker">Activity</span><h2>History</h2></div>
            {atom && <span className="count-badge" aria-label={`${history.length} revisions`}>{history.length}</span>}
          </div>
          <p className="section-help">Each completed semantic action creates one logical revision. Restore changes current state without changing this Review’s Atom identity.</p>
          {!atom && <p className="muted">Open a Review to inspect its history.</p>}
          {atom && history.length === 0 && <p className="muted">No activity yet.</p>}
          <div className="history-list">
            {[...history].reverse().map((revision) => {
              const isCurrent = revision.revisionId === atom?.meta.currentRevision;
              const isConfirming = restoreRevision?.revisionId === revision.revisionId;
              return <article key={revision.revisionId} className={isCurrent ? "history-entry current" : "history-entry"}>
                <div className="history-entry-heading">
                  <strong>r{revision.sequence}</strong>
                  {isCurrent && <span className="current-badge">Current</span>}
                </div>
                <p>{revision.summary}</p>
                <small>{revision.actor.displayName ?? revision.actor.key} · <time dateTime={new Date(revision.occurredAt).toISOString()}>{formatReviewTime(revision.occurredAt)}</time></small>
                {atom && !isCurrent && !isConfirming && <button className="link-button warning-link" type="button" disabled={busy} onClick={() => setRestoreRevision(revision)}>Restore…</button>}
                {atom && isConfirming && <div className="restore-confirm" role="alert">
                  <strong>Restore revision r{revision.sequence}?</strong>
                  <span>This makes that content current while keeping the same Review Atom and preserving all history.</span>
                  <div className="restore-actions">
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => setRestoreRevision(null)}>Cancel</button>
                    <button className="danger-button" type="button" disabled={busy} onClick={() => void apply({ type: "history.restore", revisionId: revision.revisionId }).then(() => setRestoreRevision(null))}>Restore revision</button>
                  </div>
                </div>}
              </article>;
            })}
          </div>
        </section>
      </aside>
    </div>
  </main>;
}

function FirstRunState() {
  return <div className="first-run-state">
    <span className="section-kicker">First Review</span>
    <h2>Review turns an outcome into work you can inspect and revisit.</h2>
    <p className="first-run-lead">Create a Review, add an item, decide how important it is, estimate the effort, assign an owner, track the work, and record evidence as you learn.</p>
    <div className="first-run-grid">
      <div className="first-run-step"><span>1</span><div><strong>Create a Review</strong><p>Give the workspace a name you will recognize later.</p></div></div>
      <div className="first-run-step"><span>2</span><div><strong>Add what should be true</strong><p>Each review item keeps Desired, Effort, Owner, and Work together.</p></div></div>
      <div className="first-run-step"><span>3</span><div><strong>Add evidence</strong><p>Record whether it works and leave evidence notes. Activity is retained as logical history.</p></div></div>
    </div>
    <div className="first-run-facts">
      <div><strong>Persistence</strong><span>Completed actions are stored automatically by Review’s provider. Item detail fields clearly show when they still need “Save details.”</span></div>
      <div><strong>Sharing</strong><span>Live sharing is not available in this build. Markdown export is portability only; it does not create a shared Review.</span></div>
    </div>
  </div>;
}

function ReviewItemCard({ item, atom, busy, apply, onDirtyChange }: {
  item: ReviewItem;
  atom: ReviewAtomState;
  busy: boolean;
  apply: (operation: ReviewOperation) => Promise<void>;
  onDirtyChange: (itemId: string, dirty: boolean) => void;
}) {
  const localResult = item.results["human:local"]?.result ?? "not_tested";
  const initial = createReviewDetailsDraft(item);
  const [desired, setDesired] = useState<Desired>(initial.desired);
  const [effort, setEffort] = useState<Effort>(initial.effort);
  const [owner, setOwner] = useState(initial.owner);
  const [workState, setWorkState] = useState<WorkState>(initial.workState);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const next = createReviewDetailsDraft(item);
    setDesired(next.desired);
    setEffort(next.effort);
    setOwner(next.owner);
    setWorkState(next.workState);
  }, [item.coordination.desired, item.coordination.effort, item.coordination.owner, item.coordination.workState]);

  const dirty = hasUnsavedReviewDetails(item, { desired, effort, owner, workState });
  useEffect(() => {
    onDirtyChange(item.itemId, dirty);
    return () => onDirtyChange(item.itemId, false);
  }, [dirty, item.itemId, onDirtyChange]);

  const comments = atom.comments.filter((entry) => entry.itemId === item.itemId);
  const workDescription = WORK_STATE_OPTIONS.find((option) => option.value === workState)?.description ?? "";

  return <article className="review-card" data-item-id={item.itemId}>
    <header className="item-heading">
      <div>
        <span className="item-kicker">Review item</span>
        <h3>{item.title}</h3>
        {item.descriptionMarkdown && <p className="description">{item.descriptionMarkdown}</p>}
      </div>
      <span className={`work-badge work-${item.coordination.workState}`}>{optionLabel(WORK_STATE_OPTIONS, item.coordination.workState)}</span>
    </header>

    <section className="review-details" aria-labelledby={`details-${item.itemId}`}>
      <div className="subsection-heading">
        <div><h4 id={`details-${item.itemId}`}>Review details</h4><p>Plan what matters and where the work stands.</p></div>
        <span className={dirty ? "draft-indicator is-dirty" : "draft-indicator"}>{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>
      <div className="details-grid">
        <label className="field work-field">Work
          <select value={workState} onChange={(event) => setWorkState(event.target.value as WorkState)}>
            {WORK_STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span>{workDescription}</span>
        </label>
        <label className="field">Desired
          <select value={desired ?? ""} onChange={(event) => setDesired((event.target.value || null) as Desired)}>
            {DESIRED_OPTIONS.map((option) => <option key={option.value ?? "unset"} value={option.value ?? ""}>{option.label}</option>)}
          </select>
          <span>How strongly this outcome needs to be true.</span>
        </label>
        <label className="field">Effort
          <select value={effort ?? ""} onChange={(event) => setEffort((event.target.value || null) as Effort)}>
            {EFFORT_OPTIONS.map((option) => <option key={option.value ?? "unset"} value={option.value ?? ""}>{option.label}</option>)}
          </select>
          <span>The expected size of the work.</span>
        </label>
        <label className="field">Owner
          <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Unassigned" />
          <span>{owner.trim() ? "Responsible for moving this item forward." : "No owner is assigned yet."}</span>
        </label>
      </div>
      <div className="details-actions">
        <button className="primary-button" type="button" disabled={busy || !dirty} onClick={() => void apply({ type: "review.set_coordination", itemId: item.itemId, patch: { desired, effort, owner: owner.trim() || null, workState } })}>Save details</button>
        <span>Desired, Effort, Owner, and Work are saved together as one Review action.</span>
      </div>
    </section>

    <section className="evidence-section" aria-labelledby={`evidence-${item.itemId}`}>
      <div className="subsection-heading"><div><h4 id={`evidence-${item.itemId}`}>Evidence</h4><p>Record what you observed independently from planning and ownership.</p></div></div>
      <div className="result-picker" role="group" aria-label={`Evidence result for ${item.title}`}>
        {RESULT_OPTIONS.map((option) => {
          const active = localResult === option.value;
          return <button
            type="button"
            key={option.value}
            disabled={busy}
            aria-pressed={active}
            className={active ? `result active ${option.value}` : `result ${option.value}`}
            title={option.description}
            onClick={() => void apply({ type: "review.set_result", itemId: item.itemId, result: option.value })}
          ><span className="result-mark" aria-hidden="true" />{option.label}</button>;
        })}
      </div>

      <div className="evidence-notes">
        <h5>Evidence notes</h5>
        {comments.length === 0 && <p className="muted evidence-empty">No evidence notes yet.</p>}
        {comments.map((entry) => <article className="comment" key={entry.commentId}>
          <div className="comment-meta"><strong>{entry.displayName ?? entry.actor}</strong><time dateTime={new Date(entry.createdAt).toISOString()}>{formatReviewTime(entry.createdAt)}</time></div>
          <p>{entry.body}</p>
        </article>)}
        <div className="comment-entry">
          <label className="sr-only" htmlFor={`comment-${item.itemId}`}>Evidence note on {item.title}</label>
          <input id={`comment-${item.itemId}`} aria-label={`Comment on ${item.title}`} value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && comment.trim()) addComment(); }} placeholder="Add evidence or a review note…" />
          <button className="secondary-button" type="button" disabled={busy || !comment.trim()} onClick={addComment}>Add note</button>
        </div>
      </div>
    </section>
  </article>;

  function addComment() {
    const body = comment.trim();
    if (!body) return;
    setComment("");
    void apply({ type: "comment.add", itemId: item.itemId, body });
  }
}

function persistenceTitle({ atom, busy, error, dirtyCount }: { atom: ReviewAtomState | null; busy: boolean; error: string | null; dirtyCount: number }): string {
  if (error) return "Action failed";
  if (dirtyCount) return `${dirtyCount} unsaved item${dirtyCount === 1 ? "" : "s"}`;
  if (busy) return "Working…";
  return atom ? "Saved" : "Ready";
}

function persistenceDescription({ atom, busy, error, dirtyCount, lastSavedAt }: { atom: ReviewAtomState | null; busy: boolean; error: string | null; dirtyCount: number; lastSavedAt: number | null }): string {
  if (error) return "The last action did not complete; Review is not implying it was saved.";
  if (dirtyCount) return "Choose Save details in the edited item. Other completed actions are already durable.";
  if (busy) return "Review is completing the current action.";
  if (!atom) return "Completed actions are stored automatically by Review’s provider.";
  return `Durable through Review’s provider · ${formatReviewTime(lastSavedAt ?? atom.meta.updatedAt)}`;
}

function optionLabel<T extends string | null>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

async function call<T = unknown>(target: MsgBusEndpointId, name: string, args: Record<string, unknown>): Promise<T> {
  return await callTool({ target, name, arguments: args as any }, 30) as T;
}

function command(prefix: string): string {
  return `${prefix}-${Date.now()}-${globalThis.crypto.randomUUID()}`.slice(0, 128);
}

function message(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) return String((value as { message: unknown }).message);
  return String(value);
}

const root = document.getElementById("root");
if (!root) throw new Error("Review root element is missing");
createRoot(root).render(<App />);
