import {
  useEffect,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import {
  NativeAppButton,
  NativeAppContentSurface,
  NativeAppStateSurface,
  NativeAppStatusStrip,
  NativeAppToolbar,
} from "../../os/visual/index.ts";
import {
  MonacoEditorHost,
  type MonacoCursorState,
  type MonacoEditorCommandApi,
} from "../shared/monaco/MonacoEditorHost.tsx";
import { editorLanguageForResource } from "../shared/monaco/editorModel.ts";
import { DocumentClosePrompt } from "./DocumentClosePrompt.tsx";
import { controlInputStyle, editorErrorStyle } from "./editorChrome.ts";
import { editorLanguageDisplayName, textEditorWindowTitle } from "./editorPresentation.ts";
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
  const [commandApi, setCommandApi] = useState<MonacoEditorCommandApi | null>(null);
  const [minimap, setMinimap] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  const readOnly = target.readOnly === true;
  const language = editorLanguageForResource(snapshot.name, snapshot.mime ?? undefined);
  const lowerName = snapshot.name.toLowerCase();
  const runContextTypes = lowerName.endsWith(".run");
  const cmdLanguageSupport = lowerName.endsWith(".cmd");

  useEffect(() => {
    process.setTitle(processId, textEditorWindowTitle(snapshot.name));
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

  const runEditorCommand = (command: "find" | "replace" | "goToLine") => {
    commandApi?.run(command);
  };

  if (!target.nodeId) {
    return (
      <NativeAppContentSurface style={styles.root} aria-label="Text editor">
        <NativeAppStateSurface role="status">Choose a text file to open.</NativeAppStateSurface>
      </NativeAppContentSurface>
    );
  }

  const saveDisabled = readOnly || !snapshot.dirty || snapshot.status === "saving";
  const saveAsDisabled = !saveAsName.trim();
  const loadingDocument = snapshot.status === "idle" || snapshot.status === "loading";
  const editorCommandsDisabled = !monacoReady || commandApi === null;

  return (
    <NativeAppContentSurface style={styles.root} aria-label="Text editor" onKeyDownCapture={captureSave}>
      <style>{`.plasmon-native-input::placeholder { color: var(--plasmon-text-disabled); opacity: 1; }`}</style>
      <NativeAppToolbar style={styles.toolbar} role="toolbar" aria-label="Text file controls">
        <NativeAppButton type="button" onClick={save} disabled={saveDisabled}>Save</NativeAppButton>
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
        <NativeAppButton
          type="button"
          onClick={() => { void saveAs(); }}
          disabled={saveAsDisabled}
        >
          Create copy
        </NativeAppButton>
        <span style={styles.toolbarDivider} aria-hidden="true" />
        <NativeAppButton type="button" onClick={() => runEditorCommand("find")} disabled={editorCommandsDisabled}>Find</NativeAppButton>
        <NativeAppButton type="button" onClick={() => runEditorCommand("replace")} disabled={editorCommandsDisabled}>Replace</NativeAppButton>
        <NativeAppButton type="button" onClick={() => runEditorCommand("goToLine")} disabled={editorCommandsDisabled}>Go to line</NativeAppButton>
        <NativeAppButton type="button" aria-pressed={wordWrap} onClick={() => setWordWrap((current) => !current)}>Word wrap</NativeAppButton>
        <NativeAppButton type="button" aria-pressed={minimap} onClick={() => setMinimap((current) => !current)}>Minimap</NativeAppButton>
        {readOnly && <span style={styles.readOnly}>Read only</span>}
        {snapshot.status === "conflict" && (
          <>
            <NativeAppButton type="button" onClick={() => { void sessionRef.current?.reload(); }}>
              Reload newer file
            </NativeAppButton>
            <NativeAppButton
              type="button"
              onClick={() => { if (!readOnly) void sessionRef.current?.forceSave(); }}
              disabled={readOnly}
            >
              Overwrite newer file
            </NativeAppButton>
          </>
        )}
      </NativeAppToolbar>

      {loadingDocument ? (
        <NativeAppStateSurface role="status">Loading text…</NativeAppStateSurface>
      ) : snapshot.status === "error" && !snapshot.text ? (
        <NativeAppStateSurface tone="error" role="alert">{snapshot.error}</NativeAppStateSurface>
      ) : (
        <div style={styles.editorPane}>
          <MonacoEditorHost
            modelKey={`text:${processId}`}
            value={snapshot.text}
            language={language}
            readOnly={readOnly}
            minimap={minimap}
            wordWrap={wordWrap}
            runContextTypes={runContextTypes}
            cmdLanguageSupport={cmdLanguageSupport}
            ariaLabel="Text content"
            onChange={(value) => sessionRef.current?.edit(value)}
            onCursorChange={setCursor}
            onReadyChange={setMonacoReady}
            onCommandApiChange={setCommandApi}
          />
        </div>
      )}

      {((snapshot.error && snapshot.text) || saveAsError) && (
        <div style={editorErrorStyle} role="alert">{saveAsError ?? snapshot.error}</div>
      )}
      <NativeAppStatusStrip style={styles.status}>
        <span>{editorLanguageDisplayName(language, snapshot.name)}</span>
        <span>UTF-8</span>
        <span>Ln {cursor.line}, Col {cursor.column}{cursor.selected ? ` · ${cursor.selected} selected` : ""}</span>
        <span>{snapshot.status === "conflict" ? "Conflict" : snapshot.status === "saving" ? "Saving…" : snapshot.dirty ? "Modified" : "Saved"}</span>
      </NativeAppStatusStrip>
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
    </NativeAppContentSurface>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },
  toolbar: {
    flexWrap: "wrap",
  },
  toolbarDivider: {
    alignSelf: "stretch",
    width: 1,
    minHeight: 24,
    background: "var(--plasmon-border-subtle)",
  },
  saveAsLabel: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  label: {
    color: "var(--plasmon-text-secondary)",
    fontWeight: 600,
  },
  readOnly: {
    marginLeft: "auto",
    color: "var(--plasmon-warning)",
    font: "600 var(--plasmon-font-size-small)/1.2 var(--plasmon-font-ui)",
  },
  editorPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  status: {
    justifyContent: "flex-end",
    gap: 18,
  },
};
