import type { MonacoEditorCommand } from "../shared/monaco/editorCommands.ts";

export const MARKDOWN_EDITOR_COMMANDS: ReadonlyArray<{ command: MonacoEditorCommand; label: string }> = Object.freeze([
  { command: "find", label: "Find" },
  { command: "replace", label: "Replace" },
  { command: "goToLine", label: "Go to line" },
]);

export const MARKDOWN_EDITOR_DEFAULTS = Object.freeze({
  minimap: true,
  wordWrap: false,
});

export function markdownEditorWindowTitle(name: string): string {
  const documentName = name.trim() || "Untitled";
  return `${documentName} - Monaco Editor`;
}
