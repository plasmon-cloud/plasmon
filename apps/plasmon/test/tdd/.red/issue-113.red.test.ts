import { expect, test } from "bun:test";
import { editorLanguageForName } from "../../../src/native-apps/text/editorModel.ts";

/** #113 deterministic RED for missing Text desktop-editor chrome contract. */
test("#113 Text exposes document-aware editor chrome configuration", () => {
  expect(editorLanguageForName("example.js")).toBe("javascript");
  // Staging contract: implementation must expose a discoverable editor command/status model.
  expect(false).toBe(true);
});
