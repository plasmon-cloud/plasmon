import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createEditorSurfaceModelOwner, syncEditorModelValue, type OwnedEditorModel } from "./editorModel.ts";
import { installMonacoEnvironment } from "./monacoEnvironment.ts";

export const MONACO_ENGINE_NAME = "Monaco";
export function monacoEngineStatus(ready: boolean): string {
  return ready ? `${MONACO_ENGINE_NAME} ready` : `Loading ${MONACO_ENGINE_NAME}…`;
}

export interface MonacoCursorState {
  line: number;
  column: number;
  selected: number;
}

export interface MonacoEditorSurfaceProps {
  modelKey: string;
  value: string;
  language: string;
  readOnly?: boolean;
  visible?: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onCursorChange?: (state: MonacoCursorState) => void;
  onReadyChange?: (ready: boolean) => void;
}

type MonacoApi = typeof import("monaco-editor");
type MonacoEditor = import("monaco-editor").editor.IStandaloneCodeEditor;
type MonacoModel = import("monaco-editor").editor.ITextModel;
type MonacoDisposable = import("monaco-editor").IDisposable;

/** Thin React lifecycle adapter around Monaco. Each live surface owns its model. */
export function MonacoEditorSurface({
  modelKey,
  value,
  language,
  readOnly = false,
  visible = true,
  ariaLabel,
  onChange,
  onCursorChange,
  onReadyChange,
}: MonacoEditorSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const modelRef = useRef<MonacoModel | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const applyingExternalValueRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onReadyChangeRef = useRef(onReadyChange);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onCursorChangeRef.current = onCursorChange; }, [onCursorChange]);
  useEffect(() => { onReadyChangeRef.current = onReadyChange; }, [onReadyChange]);

  useEffect(() => {
    let cancelled = false;
    let editor: MonacoEditor | null = null;
    let ownedModel: OwnedEditorModel<MonacoModel> | null = null;
    const disposables: MonacoDisposable[] = [];
    setLoading(true);
    setError(null);
    onReadyChangeRef.current?.(false);
    installMonacoEnvironment();

    void import("monaco-editor")
      .then((monaco) => {
        if (cancelled || !containerRef.current) return;
        monacoRef.current = monaco;
        const created = createEditorSurfaceModelOwner(
          modelKey,
          (uri) => monaco.editor.createModel(value, language, monaco.Uri.parse(uri)),
        );
        const createdModel = created.model;
        createdModel.updateOptions({ tabSize: 2, insertSpaces: true, trimAutoWhitespace: false });
        const createdEditor: MonacoEditor = monaco.editor.create(containerRef.current, {
          model: createdModel,
          automaticLayout: true,
          theme: "vs-dark",
          readOnly,
          ariaLabel,
          fontSize: 14,
          lineHeight: 21,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          minimap: { enabled: false },
          lineNumbers: "on",
          glyphMargin: true,
          folding: true,
          renderLineHighlight: "line",
          padding: { top: 10, bottom: 10 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          wordWrap: "off",
        });
        ownedModel = created;
        editor = createdEditor;
        editorRef.current = createdEditor;
        modelRef.current = createdModel;
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
        setLoading(false);
        onReadyChangeRef.current?.(true);
        onCursorChangeRef.current?.({ line: 1, column: 1, selected: 0 });
        requestAnimationFrame(() => createdEditor.focus());
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoading(false);
          onReadyChangeRef.current?.(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      cancelled = true;
      onReadyChangeRef.current?.(false);
      for (const disposable of disposables) disposable.dispose();
      editor?.dispose();
      ownedModel?.dispose();
      if (editorRef.current === editor) editorRef.current = null;
      if (modelRef.current === ownedModel?.model) modelRef.current = null;
    };
  }, [modelKey]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    applyingExternalValueRef.current = true;
    try { syncEditorModelValue(model, value); }
    finally { applyingExternalValueRef.current = false; }
  }, [value]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = modelRef.current;
    if (monaco && model && model.getLanguageId() !== language) monaco.editor.setModelLanguage(model, language);
  }, [language]);

  useEffect(() => { editorRef.current?.updateOptions({ readOnly, ariaLabel }); }, [ariaLabel, readOnly]);
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
    >
      <div ref={containerRef} style={styles.editor} />
      {loading && <div style={styles.overlay} role="status">Loading editor…</div>}
      {error && <div style={{ ...styles.overlay, ...styles.error }} role="alert">Monaco failed to load: {error}</div>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, background: "#1e1e1e" },
  editor: { position: "absolute", inset: 0 },
  overlay: { position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 2, background: "#1e1e1e", color: "#c8cdd4", font: "13px/1.4 system-ui, sans-serif" },
  error: { color: "#ffd8dc", background: "#35171b", padding: 20, textAlign: "center" },
};
