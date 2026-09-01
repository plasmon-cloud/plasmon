import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { monacoActionId, type MonacoEditorCommand } from "./editorCommands.ts";
import {
  createEditorSurfaceModelOwner,
  syncEditorModelLanguage,
  syncEditorModelValue,
  type OwnedEditorModel,
} from "./editorModel.ts";
import { isSlimMonacoProfile } from "../../../os/integration/packageProfile.ts";
import { installMonacoEnvironment } from "./monacoEnvironment.ts";
import { ensureRunContextTypes } from "../../../scripting/run/monacoTypes.ts";
import { ensureCmdLanguageSupport } from "../../../scripting/cmd/monaco.ts";
import { PLASMON_MONACO_THEME_NAME, plasmonMonacoThemeData } from "./monacoTheme.ts";

export const MONACO_ENGINE_NAME = "Monaco";
export function monacoEngineStatus(ready: boolean): string {
  return ready ? `${MONACO_ENGINE_NAME} ready` : `Loading ${MONACO_ENGINE_NAME}…`;
}

export type MonacoHostPhase = "loading" | "ready" | "error";
export interface MonacoHostState {
  phase: MonacoHostPhase;
  error: string | null;
}

export interface MonacoCursorState {
  line: number;
  column: number;
  selected: number;
}

export interface MonacoEditorCommandApi {
  run(command: MonacoEditorCommand): void;
  focus(): void;
}

export interface MonacoEditorHostProps {
  modelKey: string;
  value: string;
  language: string;
  readOnly?: boolean;
  visible?: boolean;
  ariaLabel: string;
  minimap?: boolean;
  wordWrap?: boolean;
  runContextTypes?: boolean;
  cmdLanguageSupport?: boolean;
  onChange: (value: string) => void;
  onCursorChange?: (state: MonacoCursorState) => void;
  onReadyChange?: (ready: boolean) => void;
  onStateChange?: (state: MonacoHostState) => void;
  onCommandApiChange?: (api: MonacoEditorCommandApi | null) => void;
}

type MonacoApi = typeof import("monaco-editor");
type MonacoEditor = import("monaco-editor").editor.IStandaloneCodeEditor;
type MonacoModel = import("monaco-editor").editor.ITextModel;
type MonacoDisposable = import("monaco-editor").IDisposable;

function configureSlimLanguageServices(monaco: MonacoApi): void {
  if (!isSlimMonacoProfile) return;

  const modeConfiguration = {
    completionItems: false,
    hovers: false,
    documentSymbols: false,
    definitions: false,
    references: false,
    documentHighlights: false,
    rename: false,
    diagnostics: false,
    documentRangeFormattingEdits: false,
    signatureHelp: false,
    onTypeFormattingEdits: false,
    codeActions: false,
    inlayHints: false,
  } as const;
  monaco.languages.typescript.javascriptDefaults.setModeConfiguration(modeConfiguration);
  monaco.languages.typescript.typescriptDefaults.setModeConfiguration(modeConfiguration);
}

/**
 * Shared browser-runtime adapter for Text and Markdown. The host owns only the
 * concrete Monaco editor/model lifecycle. Filesystem/document/save/close policy
 * remains with the calling native application.
 */
export function MonacoEditorHost({
  modelKey,
  value,
  language,
  readOnly = false,
  visible = true,
  ariaLabel,
  minimap = false,
  wordWrap = false,
  runContextTypes = false,
  cmdLanguageSupport = false,
  onChange,
  onCursorChange,
  onReadyChange,
  onStateChange,
  onCommandApiChange,
}: MonacoEditorHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const modelRef = useRef<MonacoModel | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const languageRef = useRef(language);
  const applyingExternalValueRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onReadyChangeRef = useRef(onReadyChange);
  const onStateChangeRef = useRef(onStateChange);
  const onCommandApiChangeRef = useRef(onCommandApiChange);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLanguage, setModelLanguage] = useState<string | null>(null);
  const [modelUri, setModelUri] = useState<string | null>(null);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onCursorChangeRef.current = onCursorChange; }, [onCursorChange]);
  useEffect(() => { onReadyChangeRef.current = onReadyChange; }, [onReadyChange]);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { onCommandApiChangeRef.current = onCommandApiChange; }, [onCommandApiChange]);

  useEffect(() => {
    let cancelled = false;
    let editor: MonacoEditor | null = null;
    let ownedModel: OwnedEditorModel<MonacoModel> | null = null;
    let themeObserver: MutationObserver | null = null;
    const disposables: MonacoDisposable[] = [];
    setLoading(true);
    setError(null);
    setModelLanguage(null);
    setModelUri(null);
    onReadyChangeRef.current?.(false);
    onCommandApiChangeRef.current?.(null);
    onStateChangeRef.current?.({ phase: "loading", error: null });
    installMonacoEnvironment();

    void import("monaco-editor")
      .then((monaco) => {
        if (cancelled || !containerRef.current) return;
        const container = containerRef.current;
        monacoRef.current = monaco;
        configureSlimLanguageServices(monaco);
        if (runContextTypes) ensureRunContextTypes(monaco);
        if (cmdLanguageSupport) ensureCmdLanguageSupport(monaco);

        const applyVisualTheme = () => {
          monaco.editor.defineTheme(
            PLASMON_MONACO_THEME_NAME,
            plasmonMonacoThemeData(getComputedStyle(container)),
          );
          monaco.editor.setTheme(PLASMON_MONACO_THEME_NAME);
        };
        applyVisualTheme();

        const themeHost = container.closest("[data-plasmon-theme]");
        if (themeHost && typeof MutationObserver !== "undefined") {
          themeObserver = new MutationObserver(() => applyVisualTheme());
          themeObserver.observe(themeHost, {
            attributes: true,
            attributeFilter: ["data-plasmon-theme"],
          });
        }

        const created = createEditorSurfaceModelOwner(
          modelKey,
          (uri) => monaco.editor.createModel(value, languageRef.current, monaco.Uri.parse(uri)),
        );
        const createdModel = created.model;
        createdModel.updateOptions({ tabSize: 2, insertSpaces: true, trimAutoWhitespace: false });
        const createdEditor: MonacoEditor = monaco.editor.create(container, {
          model: createdModel,
          automaticLayout: true,
          theme: PLASMON_MONACO_THEME_NAME,
          readOnly,
          ariaLabel,
          fontSize: 14,
          lineHeight: 21,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          minimap: { enabled: minimap },
          lineNumbers: "on",
          glyphMargin: true,
          folding: true,
          renderLineHighlight: "line",
          padding: { top: 10, bottom: 10 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          wordWrap: wordWrap ? "on" : "off",
        });
        ownedModel = created;
        editor = createdEditor;
        editorRef.current = createdEditor;
        modelRef.current = createdModel;
        setModelUri(created.uri);
        setModelLanguage(createdModel.getLanguageId());
        disposables.push(
          createdEditor.onDidChangeModelContent(() => {
            if (!applyingExternalValueRef.current) onChangeRef.current(createdModel.getValue());
          }),
          createdEditor.onDidChangeCursorSelection((event) => {
            onCursorChangeRef.current?.({
              line: event.selection.positionLineNumber,
              column: event.selection.positionColumn,
              selected: createdModel.getValueInRange(event.selection).length,
            });
          }),
        );
        onCommandApiChangeRef.current?.({
          run(command) {
            const action = createdEditor.getAction(monacoActionId(command));
            if (action) void action.run();
          },
          focus() {
            createdEditor.focus();
          },
        });
        setLoading(false);
        onReadyChangeRef.current?.(true);
        onStateChangeRef.current?.({ phase: "ready", error: null });
        onCursorChangeRef.current?.({ line: 1, column: 1, selected: 0 });
        requestAnimationFrame(() => createdEditor.focus());
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          const message = reason instanceof Error ? reason.message : String(reason);
          setLoading(false);
          setModelLanguage(null);
          setModelUri(null);
          onReadyChangeRef.current?.(false);
          onCommandApiChangeRef.current?.(null);
          onStateChangeRef.current?.({ phase: "error", error: message });
          setError(message);
        }
      });

    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      onReadyChangeRef.current?.(false);
      onCommandApiChangeRef.current?.(null);
      for (const disposable of disposables) disposable.dispose();
      editor?.dispose();
      ownedModel?.dispose();
      if (editorRef.current === editor) editorRef.current = null;
      if (modelRef.current === ownedModel?.model) modelRef.current = null;
    };
  }, [cmdLanguageSupport, modelKey, runContextTypes]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    applyingExternalValueRef.current = true;
    try { syncEditorModelValue(model, value); }
    finally { applyingExternalValueRef.current = false; }
  }, [value]);

  useEffect(() => {
    languageRef.current = language;
    const monaco = monacoRef.current;
    const model = modelRef.current;
    if (!monaco || !model) return;
    syncEditorModelLanguage(
      model,
      language,
      (target, nextLanguage) => monaco.editor.setModelLanguage(target, nextLanguage),
    );
    setModelLanguage(model.getLanguageId());
  }, [language]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      readOnly,
      ariaLabel,
      minimap: { enabled: minimap },
      wordWrap: wordWrap ? "on" : "off",
    });
  }, [ariaLabel, minimap, readOnly, wordWrap]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => editorRef.current?.layout());
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return (
    <div
      style={styles.root}
      aria-label={ariaLabel}
      data-editor-engine="monaco"
      data-editor-ready={loading || error ? "false" : "true"}
      data-editor-state={error ? "error" : loading ? "loading" : "ready"}
      data-editor-language={modelLanguage ?? ""}
      data-editor-model-uri={modelUri ?? ""}
    >
      <div ref={containerRef} style={styles.editor} />
      {loading && <div style={styles.overlay} role="status">Loading editor…</div>}
      {error && <div style={{ ...styles.overlay, ...styles.error }} role="alert">Monaco failed to load: {error}</div>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    background: "var(--plasmon-window-background)",
  },
  editor: { position: "absolute", inset: 0 },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    zIndex: 2,
    background: "var(--plasmon-window-background)",
    color: "var(--plasmon-text-secondary)",
    font: "13px/1.4 system-ui, sans-serif",
  },
  error: {
    color: "var(--plasmon-danger)",
    background: "color-mix(in srgb, var(--plasmon-danger) 10%, var(--plasmon-window-background))",
    padding: 20,
    textAlign: "center",
  },
};
