import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import { DocumentClosePrompt } from "../text/DocumentClosePrompt.tsx";
import { controlButtonStyle, editorChrome, editorErrorStyle, editorStatusStyle } from "../text/editorChrome.ts";
import { MonacoEditorSurface, monacoEngineStatus, type MonacoCursorState } from "../text/MonacoEditorSurface.tsx";
import { useDocumentCloseProtection } from "../text/useDocumentCloseProtection.ts";
import { useDocumentSession } from "../text/useDocumentSession.ts";
import { MarkdownPreview } from "./MarkdownPreview.tsx";

export type MarkdownMode = "edit" | "split" | "preview";
export const MARKDOWN_MODES = ["edit", "split", "preview"] as const;
export function markdownPaneVisibility(mode: MarkdownMode): { editor: boolean; preview: boolean } {
  return { editor: mode !== "preview", preview: mode !== "edit" };
}
export interface MarkdownEditorProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
}

export default function MarkdownEditor({ processId, target, fs, process }: MarkdownEditorProps) {
  const [mode, setMode] = useState<MarkdownMode>("split");
  const [cursor, setCursor] = useState<MonacoCursorState>({ line: 1, column: 1, selected: 0 });
  const [monacoReady, setMonacoReady] = useState(false);
  const { snapshot, sessionRef } = useDocumentSession(fs, target.nodeId);
  const closeProtection = useDocumentCloseProtection(process, processId, sessionRef, target.nodeId);
  const readOnly = target.readOnly === true;
  const visible = markdownPaneVisibility(mode);

  useEffect(() => {
    process.setTitle(processId, snapshot.name || "Markdown");
  }, [process, processId, snapshot.name]);

  const save = () => {
    if (!readOnly) void sessionRef.current?.save();
  };

  const captureSave = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  };

  if (!target.nodeId) {
    return <div style={styles.message} role="status">Choose a Markdown file to open.</div>;
  }

  const saveDisabled = readOnly || !snapshot.dirty || snapshot.status === "saving";
  const loadingDocument = snapshot.status === "idle" || snapshot.status === "loading";

  return (
    <section style={styles.root} aria-label="Markdown editor" onKeyDownCapture={captureSave}>
      <div style={styles.toolbar} role="toolbar" aria-label="Markdown mode and save controls">
        <span style={styles.engineBadge} role="status">{monacoEngineStatus(monacoReady)}</span>
        {MARKDOWN_MODES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={mode === candidate}
            style={controlButtonStyle(false, mode === candidate)}
            onClick={() => setMode(candidate)}
          >
            {candidate[0]!.toUpperCase() + candidate.slice(1)}
          </button>
        ))}
        <span style={styles.spacer} />
        {readOnly && <span style={styles.readOnly}>Read only</span>}
        <button type="button" style={controlButtonStyle(saveDisabled)} onClick={save} disabled={saveDisabled}>Save</button>
        {snapshot.status === "conflict" && (
          <>
            <button type="button" style={controlButtonStyle(false)} onClick={() => { void sessionRef.current?.reload(); }}>Reload newer file</button>
            <button type="button" style={controlButtonStyle(readOnly)} onClick={() => { if (!readOnly) void sessionRef.current?.forceSave(); }} disabled={readOnly}>Overwrite newer file</button>
          </>
        )}
      </div>

      {loadingDocument ? (
        <div style={styles.message} role="status">Loading Markdown…</div>
      ) : snapshot.status === "error" && !snapshot.text ? (
        <div style={styles.fatalError} role="alert">{snapshot.error}</div>
      ) : (
        <div style={styles.workarea}>
          <div
            style={{
              ...styles.editorPane,
              display: visible.editor ? "flex" : "none",
              flexBasis: mode === "split" ? "50%" : "100%",
              borderRight: mode === "split" ? `1px solid ${editorChrome.border}` : "none",
            }}
          >
            <MonacoEditorSurface
              modelKey={`${processId}:${snapshot.nodeId ?? target.nodeId}:markdown`}
              value={snapshot.text}
              language="markdown"
              readOnly={readOnly}
              visible={visible.editor}
              ariaLabel="Markdown source"
              onChange={(value) => sessionRef.current?.edit(value)}
              onCursorChange={setCursor}
              onReadyChange={setMonacoReady}
            />
          </div>
          <div
            style={{
              ...styles.previewPane,
              display: visible.preview ? "flex" : "none",
              flexBasis: mode === "split" ? "50%" : "100%",
            }}
          >
            <MarkdownPreview source={snapshot.text} visible={visible.preview} />
          </div>
        </div>
      )}

      {snapshot.error && snapshot.text && <div style={editorErrorStyle} role="alert">{snapshot.error}</div>}
      <footer style={editorStatusStyle}>
        <span>UTF-8 · Markdown</span>
        <span>Ln {cursor.line}, Col {cursor.column}{cursor.selected ? ` · ${cursor.selected} selected` : ""}</span>
        <span>{snapshot.status === "conflict" ? "Conflict" : snapshot.status === "saving" ? "Saving…" : snapshot.dirty ? "Modified" : "Saved"}</span>
      </footer>
      {closeProtection.snapshot.pending && (
        <DocumentClosePrompt
          documentName={snapshot.name}
          saving={closeProtection.snapshot.saving}
          status={snapshot.status}
          error={snapshot.error}
          onSave={() => { void closeProtection.saveAndClose(); }}
          onDiscard={() => { closeProtection.discardAndClose(); }}
          onCancel={() => { closeProtection.cancelClose(); }}
        />
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { position: "relative", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: editorChrome.background, color: editorChrome.text },
  toolbar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, padding: 8, background: editorChrome.panel, borderBottom: `1px solid ${editorChrome.border}` },
  engineBadge: { padding: "4px 7px", border: `1px solid ${editorChrome.border}`, borderRadius: 4, background: "#171b21", color: "#b8d8ff", font: "600 11px/1.2 system-ui, sans-serif" },
  spacer: { flex: 1 },
  readOnly: { color: "#d6bd75", font: "600 12px/1.2 system-ui, sans-serif" },
  workarea: { display: "flex", flex: 1, minHeight: 0, minWidth: 0 },
  editorPane: { minWidth: 0, minHeight: 0, flex: "1 1 50%" },
  previewPane: { minWidth: 0, minHeight: 0, flex: "1 1 50%" },
  message: { flex: 1, display: "grid", placeItems: "center", padding: 24, background: editorChrome.background, color: editorChrome.muted },
  fatalError: { ...editorErrorStyle, flex: 1, display: "grid", placeItems: "center", textAlign: "center" },
};
