import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  callTool,
  loadTileContext,
  onAppStateChange,
  type MsgBusEndpointId,
} from "neutron-tools/app";
import type {
  ReviewAtomMeta,
  ReviewAtomState,
  ReviewItem,
  ReviewOperation,
  ReviewRevision,
  TestResult,
} from "./model.ts";
import { draftAfterReviewAction, settleReviewAction } from "./action_outcome.ts";
import { formatReviewTime } from "./presentation.ts";
import type { ReviewSubmission } from "./submission.ts";
import "./style.scss";

const STATE_TOPIC = "review.state";
const LOCAL_ACTOR = "human:local";
const DEFAULT_IMPORT_PATH = "/review-plan.md";
const DEFAULT_SUBMIT_PATH = "/review-submission.md";

export function App() {
  const context = useMemo(() => loadTileContext(), []);
  const target = `app:${context.app ?? "review"}:background` as MsgBusEndpointId;
  const [atoms, setAtoms] = useState<ReviewAtomMeta[]>([]);
  const [atom, setAtom] = useState<ReviewAtomState | null>(null);
  const [history, setHistory] = useState<ReviewRevision[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newItem, setNewItem] = useState("");
  const [importPath, setImportPath] = useState(DEFAULT_IMPORT_PATH);
  const [submitPath, setSubmitPath] = useState(DEFAULT_SUBMIT_PATH);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatesQueued, setUpdatesQueued] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [submission, setSubmission] = useState<ReviewSubmission | null>(null);
  const [restoreRevision, setRestoreRevision] = useState<ReviewRevision | null>(null);

  const readAtom = useCallback(async (atomId: string) => {
    const [next, revisions, submissionState] = await Promise.all([
      call<ReviewAtomState>(target, "review_atom", { atomId }),
      call<{ revisions: ReviewRevision[] }>(target, "review_history", { atomId }),
      call<{ submission: ReviewSubmission | null }>(target, "review_submission", { atomId }),
    ]);
    setAtom(next);
    setHistory(revisions.revisions);
    setSubmission(submissionState.submission);
    setSubmitPath(submissionState.submission?.path ?? DEFAULT_SUBMIT_PATH);
    setAtoms((current) => current.map((entry) => entry.atomId === atomId ? next.meta : entry));
    setLastSavedAt(next.meta.updatedAt);
    setUpdatesQueued(false);
  }, [target]);

  const refreshCatalog = useCallback(async (preferredAtomId?: string) => {
    const catalog = await call<{ atoms: ReviewAtomMeta[] }>(target, "review_catalog", {});
    setAtoms(catalog.atoms);
    const atomId = preferredAtomId ?? atom?.meta.atomId ?? catalog.atoms[0]?.atomId;
    if (!atomId) {
      setAtom(null);
      setHistory([]);
      setSubmission(null);
      setSubmitPath(DEFAULT_SUBMIT_PATH);
      return;
    }
    await readAtom(atomId);
  }, [atom?.meta.atomId, readAtom, target]);

  useEffect(() => {
    void refreshCatalog()
      .catch((cause) => setError(message(cause)))
      .finally(() => setLoading(false));
  }, []);

  // Shared/provider changes are deliberately not pulled into the visible Review
  // until the reviewer chooses Refresh. Local accepted actions still update the
  // durable provider immediately.
  useEffect(() => onAppStateChange(STATE_TOPIC, () => setUpdatesQueued(true)), []);

  const perform = useCallback(async (work: () => Promise<void>, options: { persisted?: boolean } = {}): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const outcome = await settleReviewAction(work);
    if (outcome.ok) {
      if (options.persisted) setLastSavedAt(Date.now());
    } else {
      setError(outcome.error);
    }
    setBusy(false);
    return outcome.ok;
  }, []);

  const createReview = async () => {
    const title = newTitle.trim() || "Untitled Review";
    let createdAtomId = "";
    const accepted = await perform(async () => {
      const result = await call<{ atomId: string }>(target, "review_create", {
        commandId: command("create"),
        title,
      });
      createdAtomId = result.atomId;
    }, { persisted: true });
    if (!accepted || !createdAtomId) return;
    setNewTitle("");
    await refreshCatalog(createdAtomId);
    setNotice("Review created. Your local review progress is saved as you record it.");
  };

  const importReview = async () => {
    let imported: { atomId: string; importedItems: number } | null = null;
    const accepted = await perform(async () => {
      imported = await call<{ atomId: string; importedItems: number }>(target, "review_file", {
        action: "import",
        commandId: command("import"),
        path: importPath.trim(),
      });
    }, { persisted: true });
    if (!accepted || !imported) return;
    const result = imported as { atomId: string; importedItems: number };
    await refreshCatalog(result.atomId);
    setNotice(`Imported ${result.importedItems} acceptance check${result.importedItems === 1 ? "" : "s"}.`);
  };

  const apply = useCallback(async (operation: ReviewOperation): Promise<boolean> => {
    if (!atom) return false;
    let nextRevision = atom.meta.currentRevision;
    const accepted = await perform(async () => {
      const result = await call<{ revisionId: string }>(target, "review_command", {
        atomId: atom.meta.atomId,
        expectedRevision: atom.meta.currentRevision,
        commandId: command(operation.type),
        operation,
      });
      nextRevision = result.revisionId;
    }, { persisted: true });
    if (!accepted) return false;
    try {
      await readAtom(atom.meta.atomId);
      setLastSavedAt(Date.now());
    } catch (cause) {
      setNotice(`Your action was saved as revision ${nextRevision}, but the view could not refresh. Use Refresh before continuing. ${message(cause)}`);
      setUpdatesQueued(true);
    }
    return true;
  }, [atom, perform, readAtom, target]);

  const addItem = () => {
    const title = newItem.trim();
    if (!title || busy) return;
    void apply({ type: "review.create_item", title }).then((succeeded) => {
      setNewItem((current) => draftAfterReviewAction(current, title, succeeded));
    });
  };

  const manualRefresh = () => {
    if (!atom || busy) return;
    void perform(async () => {
      await refreshCatalog(atom.meta.atomId);
    }).then((ok) => {
      if (ok) setNotice("Refreshed. You are now seeing the latest queued reviewer updates.");
    });
  };

  const submitReview = () => {
    if (!atom || busy) return;
    void perform(async () => {
      const result = await call<{ submission: ReviewSubmission }>(target, "review_file", {
        action: "export",
        atomId: atom.meta.atomId,
        expectedRevision: atom.meta.currentRevision,
        path: submitPath.trim(),
      });
      setSubmission(result.submission);
      setSubmitPath(result.submission.path);
      setNotice(`Submitted revision r${atom.meta.currentSequence} to ${result.submission.path}. This snapshot is ready to give to an AI for issue triage.`);
    });
  };

  const progress = atom ? reviewProgress(atom) : null;
  const lastSubmittedRevision = submission?.revisionId ?? null;
  const hasUnsubmittedChanges = !!atom && lastSubmittedRevision !== atom.meta.currentRevision;

  return <main className="review-app">
    <header className="review-header">
      <div className="review-identity">
        <span className="eyebrow">Review</span>
        <h1>{atom?.meta.title ?? "Human acceptance review"}</h1>
        <p>{atom
          ? "Follow each check in the real OS, record what happened, and come back later without losing your progress."
          : "Turn an acceptance plan into durable human verification before engineering work is created."}</p>
      </div>
      <div className="header-actions">
        {atom && <button className={updatesQueued ? "refresh-button has-updates" : "refresh-button"} type="button" disabled={busy} onClick={manualRefresh}>
          {updatesQueued ? "Refresh · updates waiting" : "Refresh"}
        </button>}
        <div className="persistence-status" role="status" aria-live="polite">
          <span className="status-mark" aria-hidden="true" />
          <div><strong>{busy ? "Saving…" : error ? "Action failed" : "Local progress saved"}</strong>
            <span>{atom ? `Last local save ${formatReviewTime(lastSavedAt ?? atom.meta.updatedAt)}` : "Completed review actions persist locally."}</span>
          </div>
        </div>
      </div>
    </header>

    {updatesQueued && <div className="banner update" role="status"><strong>Reviewer updates are waiting.</strong><span>They will not change what you see until you choose Refresh.</span></div>}
    {error && <div className="banner error" role="alert"><strong>Action failed.</strong><span>{error}</span></div>}
    {notice && <div className="banner notice" role="status"><strong>Done.</strong><span>{notice}</span></div>}

    <div className="review-shell">
      <aside className="review-nav" aria-label="Reviews">
        <section className="nav-section">
          <span className="section-kicker">Start</span>
          <h2>New review</h2>
          <p className="section-help">Create one manually, or import an AI-generated acceptance plan.</p>
          <label className="control-label" htmlFor="new-review-title">Review name</label>
          <input id="new-review-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="r2 human acceptance" />
          <button className="primary-button full-width" type="button" disabled={busy} onClick={() => void createReview()}>Create review</button>
          <div className="panel-divider" />
          <label className="control-label" htmlFor="review-import-path">Import test plan</label>
          <input id="review-import-path" value={importPath} onChange={(event) => setImportPath(event.target.value)} />
          <button className="secondary-button full-width" type="button" disabled={busy || !importPath.trim()} onClick={() => void importReview()}>Import AI test plan</button>
        </section>

        <section className="nav-section">
          <div className="section-heading"><div><span className="section-kicker">Saved</span><h2>Your reviews</h2></div><span className="count-badge">{atoms.length}</span></div>
          {loading && <p className="muted">Loading Reviews…</p>}
          {!loading && atoms.length === 0 && <p className="muted">No Reviews yet.</p>}
          <div className="atom-list">
            {atoms.map((entry) => <button key={entry.atomId} type="button" className={entry.atomId === atom?.meta.atomId ? "atom-choice active" : "atom-choice"} disabled={busy} onClick={() => void perform(() => readAtom(entry.atomId))}>
              <strong>{entry.title}</strong><span>Updated {formatReviewTime(entry.updatedAt)}</span>
            </button>)}
          </div>
        </section>
      </aside>

      <section className="review-workspace" aria-label="Current Review workspace">
        {!loading && !atom && <FirstRunState />}
        {loading && <div className="workspace-empty"><h2>Opening your Reviews…</h2></div>}
        {atom && <>
          <div className="workspace-heading">
            <div><span className="section-kicker">Current review</span><h2>{atom.meta.title}</h2>
              <p>{progress!.reviewed} of {progress!.total} checks reviewed by you.</p></div>
            <div className="progress-summary" aria-label="Your review progress">
              <span className="progress-pass"><strong>{progress!.passed}</strong> Pass</span>
              <span className="progress-fail"><strong>{progress!.failed}</strong> Fail</span>
              <span><strong>{progress!.remaining}</strong> Remaining</span>
            </div>
          </div>

          <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress!.total ? (progress!.reviewed / progress!.total) * 100 : 0}%` }} /></div>

          <div className="add-item-panel">
            <div><label className="control-label" htmlFor="new-review-item">Add acceptance check</label><p>Use this for a criterion a human can verify in the real OS.</p></div>
            <div className="inline-control"><input id="new-review-item" value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} placeholder="e.g. Back navigation returns to the prior folder" />
              <button className="primary-button" type="button" disabled={busy || !newItem.trim()} onClick={addItem}>Add check</button></div>
          </div>

          {atom.items.length === 0 && <div className="workspace-empty compact"><span className="section-kicker">No checks yet</span><h3>Import or add acceptance checks</h3><p>An AI-generated plan should say what to test, how a human should perform it in the real OS, and what successful behavior looks like.</p></div>}

          <div className="review-items">
            {atom.items.map((item, index) => <ReviewItemCard key={item.itemId} item={item} index={index + 1} atom={atom} busy={busy} apply={apply} />)}
          </div>
        </>}
      </section>

      <aside className="review-inspector" aria-label="Review context and submission">
        <section className="side-panel submit-panel">
          <span className="section-kicker">Publish</span><h2>Submit review</h2>
          <p className="section-help">Recorded results are saved immediately. The AI-facing snapshot changes only when you choose Submit.</p>
          {atom && <div className={hasUnsubmittedChanges ? "submission-state pending" : "submission-state current"}>
            <strong>{hasUnsubmittedChanges ? "Changes not submitted" : "Submitted snapshot is current"}</strong>
            <span>{submission ? `Last submitted ${submission.revisionId} · ${formatReviewTime(submission.submittedAt)}` : "Nothing has been submitted yet."}</span>
          </div>}
          <label className="control-label" htmlFor="submit-path">Submission file</label>
          <input id="submit-path" value={submitPath} onChange={(event) => setSubmitPath(event.target.value)} />
          <button className="submit-button full-width" type="button" disabled={busy || !atom || !submitPath.trim()} onClick={submitReview}>Submit</button>
          <p className="fine-print">Submit writes a deliberate snapshot for an AI or engineer to consume. It does not give an AI live access to this Review.</p>
        </section>

        <section className="side-panel collaboration-panel">
          <span className="section-kicker">Collaboration</span><h2>Reviewer context</h2>
          <p className="section-help">Each reviewer keeps independent results. Other reviewers' queued changes appear only after Refresh.</p>
          {atom ? <ReviewerSummary atom={atom} /> : <p className="muted">Open a Review to see reviewer activity.</p>}
          <div className="availability-row"><span className="availability-icon">—</span><div><strong>MTN live sharing is not wired yet</strong><span>The UI already follows explicit Refresh semantics so shared updates cannot interrupt a review in progress.</span></div></div>
        </section>

        <section className="side-panel history-panel">
          <div className="section-heading"><div><span className="section-kicker">Context</span><h2>Activity</h2></div>{atom && <span className="count-badge">{history.length}</span>}</div>
          {!atom && <p className="muted">Open a Review to inspect activity.</p>}
          <div className="history-list">
            {[...history].reverse().slice(0, 24).map((revision) => {
              const current = revision.revisionId === atom?.meta.currentRevision;
              const confirming = restoreRevision?.revisionId === revision.revisionId;
              return <article className={current ? "history-entry current" : "history-entry"} key={revision.revisionId}>
                <div className="history-entry-heading"><strong>r{revision.sequence}</strong>{current && <span className="current-badge">Current</span>}</div>
                <p>{revision.summary}</p><small>{revision.actor.displayName ?? revision.actor.key} · {formatReviewTime(revision.occurredAt)}</small>
                {atom && !current && !confirming && <button className="link-button" type="button" disabled={busy} onClick={() => setRestoreRevision(revision)}>Restore…</button>}
                {atom && confirming && <div className="restore-confirm"><strong>Restore r{revision.sequence}?</strong><span>This creates a new current revision and keeps the Review history.</span><div className="restore-actions"><button className="secondary-button" type="button" onClick={() => setRestoreRevision(null)}>Cancel</button><button className="danger-button" type="button" disabled={busy} onClick={() => void apply({ type: "history.restore", revisionId: revision.revisionId }).then((ok) => { if (ok) setRestoreRevision(null); })}>Restore</button></div></div>}
              </article>;
            })}
          </div>
        </section>
      </aside>
    </div>
  </main>;
}

function FirstRunState() {
  return <div className="first-run-state"><span className="section-kicker">Human acceptance</span><h2>Test the real OS. Record what actually happened.</h2>
    <p className="first-run-lead">Review is the handoff between an acceptance plan and engineering work. An AI or engineer defines what needs verification; humans perform those checks in Plasmon and record the evidence.</p>
    <div className="first-run-grid">
      <div className="first-run-step"><span>1</span><div><strong>Load the plan</strong><p>Import an AI-generated checklist based on r2 issues and acceptance criteria.</p></div></div>
      <div className="first-run-step"><span>2</span><div><strong>Perform the checks</strong><p>Follow the real OS workflow and mark Pass or Fail. Your progress remains saved when you leave.</p></div></div>
      <div className="first-run-step"><span>3</span><div><strong>Submit when ready</strong><p>Only Submit publishes a fresh snapshot for AI-assisted issue triage.</p></div></div>
    </div>
  </div>;
}

function ReviewItemCard({ item, index, atom, busy, apply }: { item: ReviewItem; index: number; atom: ReviewAtomState; busy: boolean; apply: (operation: ReviewOperation) => Promise<boolean> }) {
  const local = item.results[LOCAL_ACTOR];
  const [note, setNote] = useState(local?.note ?? "");
  const comments = atom.comments.filter((entry) => entry.itemId === item.itemId);
  const otherResults = Object.values(item.results).filter((entry) => entry.actor !== LOCAL_ACTOR);

  useEffect(() => {
    setNote(local?.note ?? "");
  }, [local?.revisionId]);

  const saveResult = (result: TestResult, resultNote = note) => {
    void apply({ type: "review.set_result", itemId: item.itemId, result, note: resultNote.trim() || null });
  };

  return <article className={`review-card ${local?.result === "working" ? "is-pass" : local?.result === "not_working" ? "is-fail" : ""}`}>
    <header className="item-heading"><div className="item-number">{index}</div><div className="item-title"><span className="item-kicker">Acceptance check</span><h3>{item.title}</h3></div><ResultBadge result={local?.result ?? "not_tested"} /></header>

    <section className="test-instructions"><h4>How to test / expected behavior</h4>
      {item.descriptionMarkdown ? <div className="markdown-copy">{item.descriptionMarkdown}</div> : <p className="muted">No detailed instructions were supplied. Perform the check using the real Plasmon OS workflow and record what you observed.</p>}
    </section>

    <section className="your-review"><div className="subsection-heading"><div><h4>Your review</h4><p>Record your own observation. This is saved independently from other reviewers.</p></div></div>
      <label className="control-label" htmlFor={`note-${item.itemId}`}>What happened?</label>
      <textarea id={`note-${item.itemId}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for failures; useful for environment details, unexpected behavior, or anything the next reviewer should know." />
      <div className="result-actions">
        <button className={local?.result === "working" ? "pass-button active" : "pass-button"} type="button" disabled={busy} onClick={() => saveResult("working")}>✓ Pass</button>
        <button className={local?.result === "not_working" ? "fail-button active" : "fail-button"} type="button" disabled={busy || !note.trim()} title={!note.trim() ? "Explain what failed before recording a failure" : undefined} onClick={() => saveResult("not_working")}>× Fail</button>
        {local && local.result !== "not_tested" && <button className="secondary-button" type="button" disabled={busy} onClick={() => { setNote(""); saveResult("not_tested", ""); }}>Clear result</button>}
      </div>
      {local?.updatedAt && <p className="fine-print">Your last recorded result: {resultLabel(local.result)} · {formatReviewTime(local.updatedAt)}</p>}
    </section>

    {(otherResults.length > 0 || comments.length > 0) && <section className="reviewer-context"><h4>Other reviewer context</h4>
      {otherResults.map((entry) => <div className="reviewer-result" key={entry.actor}><div><strong>{entry.actor}</strong><span>{formatReviewTime(entry.updatedAt)}</span></div><ResultBadge result={entry.result} />{entry.note && <p>{entry.note}</p>}</div>)}
      {comments.map((entry) => <article className="comment" key={entry.commentId}><div className="comment-meta"><strong>{entry.displayName ?? entry.actor}</strong><time>{formatReviewTime(entry.createdAt)}</time></div><p>{entry.body}</p></article>)}
    </section>}
  </article>;
}

function ReviewerSummary({ atom }: { atom: ReviewAtomState }) {
  const actors = new Map<string, { reviewed: number; failed: number }>();
  for (const item of atom.items) {
    for (const result of Object.values(item.results)) {
      if (result.result === "not_tested") continue;
      const current = actors.get(result.actor) ?? { reviewed: 0, failed: 0 };
      current.reviewed += 1;
      if (result.result === "not_working") current.failed += 1;
      actors.set(result.actor, current);
    }
  }
  if (!actors.size) return <p className="muted">No reviewer results recorded yet.</p>;
  return <div className="reviewer-summary">{[...actors.entries()].map(([actor, value]) => <div key={actor}><strong>{actor === LOCAL_ACTOR ? "You" : actor}</strong><span>{value.reviewed} reviewed{value.failed ? ` · ${value.failed} failed` : ""}</span></div>)}</div>;
}

function ResultBadge({ result }: { result: TestResult }) {
  return <span className={`result-badge result-${result}`}>{resultLabel(result)}</span>;
}

function resultLabel(result: TestResult): string {
  if (result === "working") return "Pass";
  if (result === "not_working") return "Fail";
  if (result === "needs_polish") return "Needs follow-up";
  return "Not reviewed";
}

function reviewProgress(atom: ReviewAtomState) {
  let passed = 0;
  let failed = 0;
  let reviewed = 0;
  for (const item of atom.items) {
    const result = item.results[LOCAL_ACTOR]?.result ?? "not_tested";
    if (result === "working") { passed += 1; reviewed += 1; }
    else if (result === "not_working" || result === "needs_polish") { failed += 1; reviewed += 1; }
  }
  return { total: atom.items.length, reviewed, passed, failed, remaining: atom.items.length - reviewed };
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
