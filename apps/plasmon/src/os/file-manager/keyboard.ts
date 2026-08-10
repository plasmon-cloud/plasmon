export type FileManagerKeyboardCommand = "selectAll" | "copy" | "cut" | "paste" | "delete" | "rename";

const EDITING_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  ".monaco-editor",
].join(",");

export interface ClosestTargetLike {
  closest(selector: string): unknown;
}

export function isEditingKeyboardTarget(target: unknown): boolean {
  if (!target || typeof (target as ClosestTargetLike).closest !== "function") return false;
  return Boolean((target as ClosestTargetLike).closest(EDITING_SELECTOR));
}

export function fileManagerKeyboardCommand(
  key: string,
  commandModifier: boolean,
): FileManagerKeyboardCommand | null {
  const normalized = key.toLowerCase();
  if (commandModifier) {
    if (normalized === "a") return "selectAll";
    if (normalized === "c") return "copy";
    if (normalized === "x") return "cut";
    if (normalized === "v") return "paste";
  }
  if (key === "Delete") return "delete";
  if (key === "F2") return "rename";
  return null;
}
