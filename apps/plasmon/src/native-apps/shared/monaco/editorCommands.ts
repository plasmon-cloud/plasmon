export type MonacoEditorCommand = "find" | "replace" | "goToLine";

const MONACO_ACTION_IDS: Record<MonacoEditorCommand, string> = {
  find: "actions.find",
  replace: "editor.action.startFindReplaceAction",
  goToLine: "editor.action.gotoLine",
};

export function monacoActionId(command: MonacoEditorCommand): string {
  return MONACO_ACTION_IDS[command];
}
