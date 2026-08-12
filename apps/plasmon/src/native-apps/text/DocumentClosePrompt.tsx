import type { CSSProperties } from "react";
import type { DocumentSnapshot } from "./document.ts";
import {
  controlButtonStyle,
  editorChrome,
  editorErrorStyle,
} from "./editorChrome.ts";

export interface DocumentClosePromptProps {
  documentName: string;
  saving: boolean;
  status: DocumentSnapshot["status"];
  error: string | null;
  onSave(): void;
  onDiscard(): void;
  onCancel(): void;
}

export function DocumentClosePrompt({
  documentName,
  saving,
  status,
  error,
  onSave,
  onDiscard,
  onCancel,
}: DocumentClosePromptProps) {
  const displayName = documentName || "this document";
  const problem = status === "conflict"
    ? error ?? "Resolve the document conflict before saving and closing."
    : status === "error"
      ? error
      : null;

  return (
    <div style={styles.backdrop}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label={`Save changes to ${displayName}?`}
        style={styles.dialog}
      >
        <h2 style={styles.title}>Save changes?</h2>
        <p style={styles.description}>
          Save changes to <strong>{displayName}</strong> before closing?
        </p>
        {problem && <div role="alert" style={editorErrorStyle}>{problem}</div>}
        <div style={styles.actions}>
          <button
            type="button"
            style={controlButtonStyle(saving)}
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            style={controlButtonStyle(saving)}
            disabled={saving}
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            style={controlButtonStyle(saving)}
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "rgba(7, 10, 14, 0.58)",
  },
  dialog: {
    width: "min(420px, 100%)",
    display: "grid",
    gap: 14,
    padding: 20,
    border: `1px solid ${editorChrome.border}`,
    borderRadius: 8,
    background: editorChrome.panel,
    color: editorChrome.text,
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.38)",
  },
  title: {
    margin: 0,
    font: "600 18px/1.3 system-ui, sans-serif",
  },
  description: {
    margin: 0,
    color: editorChrome.muted,
    font: "13px/1.5 system-ui, sans-serif",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
};
