import { describe, expect, test } from "bun:test";
import { monacoActionId } from "./editorCommands.ts";

describe("Monaco editor command policy", () => {
  test("maps Text affordances onto Monaco built-in actions", () => {
    expect(monacoActionId("find")).toBe("actions.find");
    expect(monacoActionId("replace")).toBe("editor.action.startFindReplaceAction");
    expect(monacoActionId("goToLine")).toBe("editor.action.gotoLine");
  });
});
