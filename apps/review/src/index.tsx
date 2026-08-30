import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  callTool,
  copyToClipboard,
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
import "./review-theme.scss";

const STATE_TOPIC = "review.state";
const LOCAL_ACTOR = "human:local";
const DEFAULT_IMPORT_PATH = "/review-plan.md";
const DEFAULT_EXPORT_PATH = "/review-submission.md";
const PLAN_EXAMPLE = `# Human Acceptance Review\n\n- [ ] Explorer Back returns to the prior folder\n  1. Open Explorer.\n  2. Navigate into two folders.\n  3. Press Back.\n  Expected: Explorer returns to the folder you just left.\n\n- [ ] Markdown files open in Markdown\n  1. Open a .md file from Explorer.\n  Expected: Markdown opens the selected file.`;

export function App() {
  const context = useMemo(() => loadTileContext(), []);
  const target = `app:${context.app ?? "review"}:background` as MsgBusEndpointId;
  const [atoms, setAtoms] = useState<ReviewAtomMeta[]>([]);
  const [atom, setAtom] = useState<ReviewAtomState | null>(null);
  const [history, setHistory] = useState<ReviewRevision[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newItem, setNewItem] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importText, setImportText] = useState("");
  const [importPath, setImportPath] = useState(DEFAULT_IMPORT_PATH);
  const [exportPath, setExportPath] = useState(DEFAULT_EXPORT_PATH);
  const [submittedMarkdown, setSubmittedMarkdown] = useState("");
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
    setExportPath(submissionState.submission?.path ?? DEFAULT_EXPORT_PATH);
    setSubmittedMarkdown("");
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
      setSubmittedMarkdown("");
      return;
    }
    await readAtom(atomId);
  }, [atom?.meta.atomId, readAtom, target]);

  useEffect(() => {
    void refreshCatalog()
      .catch((cause) => setError(message(cause)))
      .finally(() => setLoading(false));
  }, []);

  // Shared/provider changes are deliberately queued. The visible Review changes
  // only when the human chooses Refresh; local accepted actions remain durable.
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
    setNotice("Empty Review created. Add checks manually or start another Review from an AI test plan.");
  };

  const importPastedPlan = async () => {
    if (!importText.trim()) return;
    let imported: { atomId: string; importedItems: number } | null = null;
    const accepted = await perform(async () => {
      imported = await call<{ atomId: string; importedItems: number }>(target, "review_import_text", {
        commandId: command("import-text"),
        markdown: importText,
        ...(importTitle.trim() ? { title: importTitle.trim() } : {}),
      });
    }, { persisted: true });
    if (!accepted || !imported) return;
    const result = imported as { atomId: string; importedItems: number };
    setImportText("");
    setImportTitle("");
    setImportOpen(false);
    await refreshCatalog(result.atomId);
    setNotice(`Created Review with ${result.importedItems} acceptance check${result.importedItems === 1 ? "" : "s"}.`);
  };

  const importFromFiles = async () => {
    if (!importPath.trim()) return;
    let imported: { atomId: string; importedItems: number } | null = null;
    const accepted = await perform(async () => {
      imported = await call<{ atomId: string; importedItems: number }>(target, "review_file", {
        action: "import",
        commandId: command("import-file"),
        path: importPath.trim(),
      });
    }, { persisted: true });
    if (!accepted || !imported) return;
    const result = imported as { atomId: string; importedItems: number };
    setImportOpen(false);
    await refreshCatalog(result.atomId);
    setNotice(`Imported ${result.importedItems} acceptance check${result.importedItems === 1 ? "" : "s"} from Files.`);
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
    void perform(() => refreshCatalog(atom.meta.atomId)).then((ok) => {
      if (ok) setNotice("Refreshed. You are now seeing the latest queued reviewer updates.");
    });
  };

  const submitReview = () => {
    if (!atom || busy) return;
    void perform(async () => {
      const result = await call<{ submission: ReviewSubmission; markdown: string }>(target, "review_submit", {
        atomId: atom.meta.atomId,
        expectedRevision: atom.meta.currentRevision,
      });
      setSubmission(result.submission);
      setSubmittedMarkdown(result.markdown);
      setNotice(`Submitted revision r${atom.meta.currentSequence}. The snapshot is fixed until you Submit again.`);
    });
  };

  const showSubmittedSnapshot = () => {
    if (!atom || !submission || busy) return;
    void perform(async () => {
      const result = await call<{ revisionId: string; markdown: string }>(target, "review_render", {
        atomId: atom.meta.atomId,
        revisionId: submission.revisionId,
      });
      setSubmittedMarkdown(result.markdown);
    });
  };

  // Clipboard access must start synchronously from the user gesture. Neutron's
  // helper proxies the write through the trusted parent page for sandboxed tiles.
  const copySubmittedSnapshot = () => {
    if (!submittedMarkdown) return;
    setError(null);
    void copyToClipboard(submittedMarkdown).then(
      () => setNotice("Submitted review copied. Paste it into the AI or engineering conversation that will triage the results."),
      (cause) => setError(`Could not copy the submitted review. ${message(cause)}`),
    );
  };

  const saveSubmittedToFiles = () => {
    if (!atom || !submission || submission.revisionId !== atom.meta.currentRevision || !exportPath.trim() || busy) return;
    void perform(async () => {
      const result = await call<{ submission: ReviewSubmission }>(target, "review_file", {
        action: "export",
        atomId: atom.meta.atomId,
        expectedRevision: atom.meta.currentRevision,
        path: exportPath.trim(),
      });
      setSubmission(result.submission);
      setExportPath(result.submission.path ?? exportPath.trim());
      setNotice(`Saved the submitted snapshot to ${result.submission.path ?? exportPath.trim()}.`);
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
          ? "Follow the real OS checks, record what happened, and come back later without losing completed work."
          : "Paste an AI-generated test plan, perform the checks in Plasmon, then Submit the human evidence."}</p>
      </div>
      <div className="header-actions">
        {atom && <button className={updatesQueued ? "refresh-button has-updates" : "refresh-button"} type="button" disabled={busy} onClick={manualRefresh}>
          {updatesQueued ? "Refresh · updates waiting" : "Refresh"}
        </button>}
        <div className="persistence-status" role="status" aria-live="polite">
          <span className="status-mark" aria-hidden="true" />
          <div><strong>{busy ? "Saving…" : error ? "Action failed" : "Local progress saved"}</strong>
            <span>{atom ? `Last local save ${formatReviewTime(lastSavedAt ?? atom.meta.updatedAt)}` : "Pass/Fail results save as you record them."}</span>
          </div>
        </div>
      </div>
    </header>

    {updatesQueued && <div className="banner update" role="status"><strong>Reviewer updates are waiting.</strong><span>Nothing on this page changes until you choose Refresh.</span></div>}
    {error && <div className="banner error" role="alert"><strong>Action failed.</strong><span>{error}</span></div>}
    {notice && <div className="banner notice" role="status"><strong>Done.</strong><span>{notice}</span></div>}

    <div className="review-shell">
      <aside className="review-nav" aria-label="Reviews">
        <section className="nav-section start-panel">
          <span className="section-kicker">Start here</span>
          <h2>Load a test plan</h2>
          <p className="section-help">Recommended: paste the checklist produced by the AI. No Files app is required.</p>
          <button className="primary-button full-width" type="button" disabled={busy} onClick={() => setImportOpen(true)}>Paste AI test plan</button>
          <div className="panel-divider" />
          <details className="empty-review-option">
            <summary>Or create an empty Review</summary>
            <label className="control-label" htmlFor="new-review-title">Review name</label>
            <input id="new-review-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="human acceptance review" />
            <button className="secondary-button full-width" type="button" disabled={busy} onClick={() => void createReview()}>Create empty Review</button>
          </details>
        </section>

        <section className="nav-section">
          <div className="section-heading"><div><span className="section-kicker">Saved locally</span><h2>Your reviews</h2></div><span className="count-badge">{atoms.length}</span></div>
          {loading && <p className="muted">Loading Reviews…</p>}
          {!loading && atoms.length === 0 && <p className="muted">No Reviews yet.</p>}
          <div className="atom-list">
            {atoms.map((entry) => <button key={entry.atomId} type="button" className={entry.atomId === atom?.meta.atomId ? "atom-choice active" : "atom-choice"} disabled={busy} onClick={() => void perform(() => readAtom(entry.atomId))}>
              <strong>{entry.title}</strong><span>Updated {formatReviewTime(entry.updatedAt)} · r{entry.currentSequence}</span>
            </button>)}
          </div>
        </section>
      </aside>

      <section className="review-workspace" aria-label="Current Review workspace">
        {!loading && !atom && <FirstRunState onImport={() => setImportOpen(true)} />}
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
            <div><label className="control-label" htmlFor="new-review-item">Add another check</label><p>For quick additions. AI plans should normally be pasted as a group.</p></div>
            <div className="inline-control"><input id="new-review-item" value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} placeholder="What should the human verify?" />
              <button className="primary-button" type="button" disabled={busy || !newItem.trim()} onClick={addItem}>Add check</button></div>
          </div>

          {atom.items.length === 0 && <div className="workspace-empty compact"><span className="section-kicker">No checks yet</span><h3>This Review is empty</h3><p>Add a check above, or create another Review by pasting the AI-generated test plan.</p><button className="secondary-button" type="button" onClick={() => setImportOpen(true)}>Paste a test plan</button></div>}

          <div className="review-items">
            {atom.items.map((item, index) => <ReviewItemCard key={item.itemId} item={item} index={index + 1} atom={atom} busy={busy} apply={apply} />)}
          </div>
        </>}
      </section>

      <aside className="review-inspector" aria-label="Review context and submission">
        <section className="side-panel submit-panel">
          <span className="section-kicker">When you are ready</span><h2>Submit review</h2>
          <p className="section-help">Your Pass/Fail work is already saved. Submit freezes the exact current revision into the snapshot that an AI or engineer should consume.</p>
          {atom && <div className={hasUnsubmittedChanges ? "submission-state pending" : "submission-state current"}>
            <strong>{hasUnsubmittedChanges ? "Current changes are not submitted" : "Submitted snapshot is current"}</strong>
            <span>{submission ? `Last submitted ${submission.revisionId} · ${formatReviewTime(submission.submittedAt)}` : "Nothing has been submitted yet."}</span>
          </div>}
          <button className="submit-button full-width" type="button" disabled={busy || !atom} onClick={submitReview}>Submit current review</button>
          <p className="fine-print">Submit does not silently send data anywhere in this build. It creates the deliberate AI-facing snapshot.</p>

          {submission && !submittedMarkdown && <button className="secondary-button full-width snapshot-action" type="button" disabled={busy} onClick={showSubmittedSnapshot}>Show submitted snapshot</button>}
          {submittedMarkdown && <div className="submission-preview-wrap">
            <label className="control-label" htmlFor="submitted-review">Submitted Markdown</label>
            <textarea id="submitted-review" aria-label="Submitted review snapshot" readOnly value={submittedMarkdown} />
            <button className="secondary-button full-width" type="button" onClick={copySubmittedSnapshot}>Copy for AI</button>
          </div>}

          <details className="optional-files">
            <summary>Save a Markdown file (optional)</summary>
            <p className="fine-print">Only use this when the Files app is installed. Copy for AI works without Files.</p>
            <label className="control-label" htmlFor="export-path">Files path</label>
            <input id="export-path" value={exportPath} onChange={(event) => setExportPath(event.target.value)} />
            <button className="secondary-button full-width" type="button" disabled={busy || !atom || !submission || hasUnsubmittedChanges || !exportPath.trim()} onClick={saveSubmittedToFiles}>Save submitted Markdown</button>
          </details>
        </section>

        <section className="side-panel collaboration-panel">
          <span className="section-kicker">People</span><h2>Reviewer context</h2>
          <p className="section-help">Each person keeps an independent result. Queued changes from others appear only when you choose Refresh.</p>
          {atom ? <ReviewerSummary atom={atom} /> : <p className="muted">Open a Review to see reviewer activity.</p>}
          <p className="fine-print collaboration-note">Live MTN sharing is the next integration step; this build already preserves the explicit Refresh boundary.</p>
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

    {importOpen && <ImportDialog
      busy={busy}
      title={importTitle}
      text={importText}
      filePath={importPath}
      onTitle={setImportTitle}
      onText={setImportText}
      onFilePath={setImportPath}
      onCancel={() => setImportOpen(false)}
      onPasteImport={() => void importPastedPlan()}
      onFileImport={() => void importFromFiles()}
    />}
  </main>;
}

function ImportDialog({ busy, title, text, filePath, onTitle, onText, onFilePath, onCancel, onPasteImport, onFileImport }: {
  busy: boolean;
  title: string;
  text: string;
  filePath: string;
  onTitle: (value: string) => void;
  onText: (value: string) => void;
  onFilePath: (value: string) => void;
  onCancel: () => void;
  onPasteImport: () => void;
  onFileImport: () => void;
}) {
  return <div className="review-dialog-backdrop" role="presentation">
    <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="import-plan-title">
      <div className="dialog-heading"><div><span className="section-kicker">New review</span><h2 id="import-plan-title">Paste AI test plan</h2><p>Paste Markdown/TODO text. Each top-level bullet or checkbox becomes one acceptance check; indented lines stay with that check as the human test instructions.</p></div><button className="dialog-close" type="button" disabled={busy} onClick={onCancel} aria-label="Close import">×</button></div>
      <label className="control-label" htmlFor="import-review-title">Review name <span className="optional-label">optional</span></label>
      <input id="import-review-title" value={title} onChange={(event) => onTitle(event.target.value)} placeholder="Uses the Markdown heading when left blank" />
      <label className="control-label" htmlFor="import-plan-text">Test plan</label>
      <textarea id="import-plan-text" className="plan-textarea" value={text} onChange={(event) => onText(event.target.value)} placeholder={PLAN_EXAMPLE} autoFocus />
      <div className="dialog-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className="primary-button" type="button" disabled={busy || !text.trim()} onClick={onPasteImport}>Create Review from plan</button></div>
      <details className="optional-files import-files">
        <summary>Open a Markdown/TODO file from Files (optional)</summary>
        <p className="fine-print">This requires the separate Files app. If it is not installed, paste the plan above instead.</p>
        <div className="file-path-row"><input aria-label="Import Files path" value={filePath} onChange={(event) => onFilePath(event.target.value)} /><button className="secondary-button" type="button" disabled={busy || !filePath.trim()} onClick={onFileImport}>Open from Files</button></div>
      </details>
    </section>
  </div>;
}

function FirstRunState({ onImport }: { onImport: () => void }) {
  return <div className="first-run-state"><span className="section-kicker">Human acceptance</span><h2>Test the real OS. Record what actually happened.</h2>
    <p className="first-run-lead">Review is the handoff between an AI-generated acceptance plan and engineering work. The AI says what humans should verify; people perform those checks in Plasmon and record the evidence.</p>
    <div className="first-run-grid">
      <div className="first-run-step"><span>1</span><div><strong>Paste the plan</strong><p>Load acceptance criteria and real OS test instructions generated by the acceptance planner.</p></div></div>
      <div className="first-run-step"><span>2</span><div><strong>Perform the checks</strong><p>Mark Pass or Fail. Recorded results persist when you close Review and return later.</p></div></div>
      <div className="first-run-step"><span>3</span><div><strong>Submit the evidence</strong><p>Submit freezes the current revision; Copy for AI hands that exact snapshot downstream.</p></div></div>
    </div>
    <button className="primary-button first-run-cta" type="button" onClick={onImport}>Paste AI test plan</button>
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

    <section className="test-instructions"><h4>Test instructions / expected result</h4>
      {item.descriptionMarkdown ? <div className="markdown-copy">{item.descriptionMarkdown}</div> : <p className="muted">No detailed instructions were supplied. Perform this check using the real Plasmon OS workflow and record what you observed.</p>}
    </section>

    <section className="your-review"><div className="subsection-heading"><div><h4>Your review</h4><p>Your result is independent from every other reviewer.</p></div></div>
      <label className="control-label" htmlFor={`note-${item.itemId}`}>What happened?</label>
      <textarea id={`note-${item.itemId}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required for Fail. Add environment details or useful evidence for Pass when needed." />
      <div className="result-actions">
        <button className={local?.result === "working" ? "pass-button active" : "pass-button"} type="button" disabled={busy} onClick={() => saveResult("working")}>✓ Pass</button>
        <button className={local?.result === "not_working" ? "fail-button active" : "fail-button"} type="button" disabled={busy || !note.trim()} title={!note.trim() ? "Explain what failed before recording a failure" : undefined} onClick={() => saveResult("not_working")}>× Fail</button>
        {local && local.result !== "not_tested" && <button className="secondary-button" type="button" disabled={busy} onClick={() => { setNote(""); saveResult("not_tested", ""); }}>Clear result</button>}
      </div>
      {local?.updatedAt && <p className="fine-print">Last recorded: {resultLabel(local.result)} · {formatReviewTime(local.updatedAt)}</p>}
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
