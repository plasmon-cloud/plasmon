import {
  useEffect,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import { DocumentClosePrompt } from "./DocumentClosePrompt.tsx";
import { controlButtonStyle, controlInputStyle, editorChrome, editorErrorStyle, editorStatusStyle } from "./editorChrome.ts";
import { editorLanguageForName } from "./editorModel.ts";
import { MonacoEditorSurface, monacoEngineStatus, type MonacoCursorState } from "./MonacoEditorSurface.tsx";
import { useDocumentCloseProtection } from "./useDocumentCloseProtection.ts";
import { useDocumentSession } from "./useDocumentSession.ts";

export interface TextEditorProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
}

export default function TextEditor({ processId, target, fs, process }: TextEditorProps) {
  const { snapshot, sessionRef } = useDocumentSession(fs, target.nodeId);
  const closeProtection = useDocumentCloseProtection(process, processId, sessionRef, target.nodeId);
  const [cursor, setCursor] = useState<MonacoCursorState>({ line: 1, column: 1, selected: 0 });
  const [monacoReady, setMonacoReady] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  const readOnly = target.readOnly === true;

  useEffect(() => {
    process.setTitle(processId, snapshot.name || "Text Editor");
  }, [process, processId, snapshot.name]);

  const save = () => {
    if (!readOnly) void sessionRef.current?.save();
  };

  const saveAs = async () => {
    const name = saveAsName.trim();
    if (!name || !sessionRef.current) return;
    setSaveAsError(null);
    try {
      const node = await sessionRef.current.saveAs(name);
      process.setTarget(processId, { ...target, nodeId: node.id, readOnly: false });
      setSaveAsName("");
    } catch (error) {
      setSaveAsError(error instanceof Error ? error.message : String(error));
    }
  };

  const captureSave = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  };

  if (!target.nodeId) {
    return <div style={styles.message} role="status">Choose a text file to open.</div>;
  }

  const saveDisabled = readOnly || !snapshot.dirty || snapshot.status === "saving";
  const saveAsDisabled = !saveAsName.trim();

  return (
    <section style={styles.root} aria-label="Text editor" onKeyDownCapture={captureSave}>
      <style>{`.plasmon-native-input::placeholder { color: #858e9b; opacity: 1; }`}</style>
      <div style={styles.toolbar} role="toolbar" aria-label="Text file controls">
        <span style={styles.engineBadge} role="status">{monacoEngineStatus(monacoReady)}</span>
        <button type="button" style={controlButtonStyle(saveDisabled)} onClick={save} disabled={saveDisabled}>Save</button>
        <label style={styles.saveAsLabel}>
          <span style={styles.label}>Save as</span>
          <input
            aria-label="Save As file name"
            className="plasmon-native-input"
            value={saveAsName}
            placeholder={snapshot.name ? `Copy of ${snapshot.name}` : "new-file.txt"}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSaveAsName(event.currentTarget.value)}
            style={controlInputStyle}
          />
        </label>
        <button type="button" style={controlButtonStyle(saveAsDisabled)} onClick={() => { void saveAs(); }} disabled={saveAsDisabled}>Create copy</button>
        {readOnly && <span style={styles.readOnly}>Read only</span>}
        {snapshot.status === "conflict" && (
          <>
            <button type="button" style={controlButtonStyle(false)} onClick={() => { void sessionRef.current?.reload(); }}>Reload newer file</button>
            <button
              type="button"
              style={controlButtonStyle(readOnly)}
              onClick={() => { if (!readOnly) void sessionRef.current?.forceSave(); }}
              disabled={readOnly}
            >
              Overwrite newer file
            </button>
          </>
        )}
      </div>

      {snapshot.status === "loading" ? (
        <div style={styles.message} role="status">Loading text…</div>
      ) : snapshot.status === "error" && !snapshot.text ? (
        <div style={styles.fatalError} role="alert">{snapshot.error}</div>
      ) : (
        <div style={styles.editorPane}>
          <MonacoEditorSurface
            modelKey={`${processId}:${snapshot.nodeId ?? target.nodeId}`}
            value={snapshot.text}
            language={editorLanguageForName(snapshot.name)}
            readOnly={readOnly}
            ariaLabel="Text content"
            onChange={(value) => sessionRef.current?.edit(value)}
            onCursorChange={setCursor}
            onReadyChange={setMonacoReady}
          />
        </div>
      )}

      {((snapshot.error && snapshot.text) || saveAsError) && (
        <div style={editorErrorStyle} role="alert">{saveAsError ?? snapshot.error}</div>
      )}
      <footer style={editorStatusStyle}>
        <span>UTF-8</span>
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
  toolbar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: 8, borderBottom: `1px solid ${editorChrome.border}`, background: editorChrome.panel, fontSize: 13 },
  engineBadge: { padding: "4px 7px", border: `1px solid ${editorChrome.border}`, borderRadius: 4, background: "#171b21", color: "#b8d8ff", font: "600 11px/1.2 system-ui, sans-serif" },
  saveAsLabel: { display: "flex", alignItems: "center", gap: 7 },
  label: { color: editorChrome.muted, fontWeight: 600 },
  readOnly: { marginLeft: "auto", color: "#d6bd75", font: "600 12px/1.2 system-ui, sans-serif" },
  editorPane: { flex: 1, minWidth: 0, minHeight: 0 },
  message: { flex: 1, display: "grid", placeItems: "center", padding: 24, background: editorChrome.background, color: editorChrome.muted },
  fatalError: { ...editorErrorStyle, flex: 1, display: "grid", placeItems: "center", textAlign: "center" },
};
