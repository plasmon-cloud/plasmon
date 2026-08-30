import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
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
import { useMonacoRuntimeConfig } from "../monaco-runtime-config/runtimeConfigContext.tsx";
import { DocumentClosePrompt } from "../text/DocumentClosePrompt.tsx";
import { editorChrome, editorErrorStyle } from "../text/editorChrome.ts";
import { useDocumentCloseProtection } from "../text/useDocumentCloseProtection.ts";
import { useDocumentSession } from "../text/useDocumentSession.ts";
import {
  MARKDOWN_EDITOR_COMMANDS,
  MARKDOWN_EDITOR_DEFAULTS,
  markdownEditorWindowTitle,
} from "./editorPresentation.ts";
import { applyMarkdownFormatter } from "./markdownFormatter.ts";
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
  const [commandApi, setCommandApi] = useState<MonacoEditorCommandApi | null>(null);
  const { snapshot: runtimeConfig, setMinimapEnabled } = useMonacoRuntimeConfig();
  const [wordWrap, setWordWrap] = useState(MARKDOWN_EDITOR_DEFAULTS.wordWrap);
  const [formatFeedback, setFormatFeedback] = useState<string | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const { snapshot, sessionRef } = useDocumentSession(fs, target.nodeId);
  const closeProtection = useDocumentCloseProtection(process, processId, sessionRef, target.nodeId);
  const readOnly = target.readOnly === true;
  const visible = markdownPaneVisibility(mode);
  const minimap = runtimeConfig.editor.minimap.enabled;

  useEffect(() => {
    process.setTitle(processId, markdownEditorWindowTitle(snapshot.name));
  }, [process, processId, snapshot.name]);

  const save = () => {
    if (!readOnly) void sessionRef.current?.save();
  };

  const format = () => {
    if (readOnly) return;
    const attempt = applyMarkdownFormatter(snapshot.text);
    if (attempt.error) {
      setFormatFeedback(null);
      setFormatError(attempt.error);
      return;
    }

    setFormatError(null);
    setFormatFeedback(attempt.changed ? "Markdown formatted" : "Markdown is already formatted");
    if (attempt.changed) sessionRef.current?.edit(attempt.text);
    if (visible.editor) commandApi?.focus();
  };

  const runEditorCommand = (command: (typeof MARKDOWN_EDITOR_COMMANDS)[number]["command"]) => {
    commandApi?.run(command);
  };

  const captureSave = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  };

  if (!target.nodeId) {
    return (
      <NativeAppContentSurface style={styles.root} aria-label="Markdown editor">
        <NativeAppStateSurface role="status">Choose a Markdown file to open.</NativeAppStateSurface>
      </NativeAppContentSurface>
    );
  }

  const saveDisabled = readOnly || !snapshot.dirty || snapshot.status === "saving";
  const loadingDocument = snapshot.status === "idle" || snapshot.status === "loading";
  const editorCommandsDisabled = !monacoReady || commandApi === null;
  const formatDisabled = readOnly || loadingDocument || snapshot.status === "saving";

  return (
    <NativeAppContentSurface style={styles.root} aria-label="Markdown editor" onKeyDownCapture={captureSave}>
      <NativeAppToolbar style={styles.toolbar} role="toolbar" aria-label="Markdown editor controls">
        {MARKDOWN_MODES.map((candidate) => (
          <NativeAppButton
            key={candidate}
            type="button"
            aria-pressed={mode === candidate}
            onClick={() => setMode(candidate)}
          >
            {candidate[0]!.toUpperCase() + candidate.slice(1)}
          </NativeAppButton>
        ))}
        <span style={styles.toolbarDivider} aria-hidden="true" />
        <NativeAppButton type="button" onClick={save} disabled={saveDisabled}>Save</NativeAppButton>
        <NativeAppButton type="button" onClick={format} disabled={formatDisabled}>Format</NativeAppButton>
        <span style={styles.toolbarDivider} aria-hidden="true" />
        {MARKDOWN_EDITOR_COMMANDS.map(({ command, label }) => (
          <NativeAppButton
            key={command}
            type="button"
            onClick={() => runEditorCommand(command)}
            disabled={editorCommandsDisabled}
          >
            {label}
          </NativeAppButton>
        ))}
        <NativeAppButton type="button" aria-pressed={wordWrap} onClick={() => setWordWrap((current) => !current)}>
          Word wrap
        </NativeAppButton>
        <NativeAppButton
          type="button"
          aria-pressed={minimap}
          onClick={() => { void setMinimapEnabled(!minimap); }}
        >
          Minimap
        </NativeAppButton>
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
        <NativeAppStateSurface role="status">Loading Markdown…</NativeAppStateSurface>
      ) : snapshot.status === "error" && !snapshot.text ? (
        <NativeAppStateSurface tone="error" role="alert">{snapshot.error}</NativeAppStateSurface>
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
            <MonacoEditorHost
              modelKey={`${processId}:${snapshot.nodeId ?? target.nodeId}:markdown`}
              value={snapshot.text}
              language="markdown"
              readOnly={readOnly}
              visible={visible.editor}
              minimap={minimap}
              wordWrap={wordWrap}
              ariaLabel="Markdown source"
              onChange={(value) => sessionRef.current?.edit(value)}
              onCursorChange={setCursor}
              onReadyChange={setMonacoReady}
              onCommandApiChange={setCommandApi}
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

      {(formatError || (snapshot.error && snapshot.text)) && (
        <div style={editorErrorStyle} role="alert">{formatError ?? snapshot.error}</div>
      )}
      <NativeAppStatusStrip style={styles.status}>
        {formatFeedback && <span role="status">{formatFeedback}</span>}
        <span>Markdown</span>
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
    height: "100%",
    minHeight: 0,
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
  readOnly: {
    marginLeft: "auto",
    color: "var(--plasmon-warning)",
    font: "600 var(--plasmon-font-size-small)/1.2 var(--plasmon-font-ui)",
  },
  workarea: { display: "flex", flex: 1, minHeight: 0, minWidth: 0 },
  editorPane: { minWidth: 0, minHeight: 0, flex: "1 1 50%" },
  previewPane: { minWidth: 0, minHeight: 0, flex: "1 1 50%" },
  status: {
    justifyContent: "flex-end",
    gap: 18,
  },
};
