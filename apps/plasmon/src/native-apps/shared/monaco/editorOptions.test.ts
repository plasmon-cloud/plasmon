import { expect, test } from "bun:test";
import { updateMonacoEditorOptions } from "./editorOptions.ts";

test("live minimap changes update one editor in place without touching its model/session state", () => {
  const model = {
    value: "unsaved text",
    undoDepth: 3,
    cursor: { line: 7, column: 4 },
    selection: "selected",
  };
  const editor = {
    model,
    updates: [] as unknown[],
    updateOptions(options: unknown) {
      this.updates.push(options);
    },
  };

  updateMonacoEditorOptions(editor, {
    readOnly: false,
    ariaLabel: "Text content",
    minimap: true,
    wordWrap: false,
  });
  updateMonacoEditorOptions(editor, {
    readOnly: false,
    ariaLabel: "Text content",
    minimap: false,
    wordWrap: false,
  });
  updateMonacoEditorOptions(editor, {
    readOnly: false,
    ariaLabel: "Text content",
    minimap: true,
    wordWrap: false,
  });

  expect(editor.updates).toEqual([
    { readOnly: false, ariaLabel: "Text content", minimap: { enabled: true }, wordWrap: "off" },
    { readOnly: false, ariaLabel: "Text content", minimap: { enabled: false }, wordWrap: "off" },
    { readOnly: false, ariaLabel: "Text content", minimap: { enabled: true }, wordWrap: "off" },
  ]);
  expect(editor.model).toBe(model);
  expect(model).toEqual({
    value: "unsaved text",
    undoDepth: 3,
    cursor: { line: 7, column: 4 },
    selection: "selected",
  });
});
