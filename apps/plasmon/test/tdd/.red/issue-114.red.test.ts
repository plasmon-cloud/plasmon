import { expect, test } from "bun:test";
import { markdownPaneVisibility } from "../../../src/native-apps/markdown/MarkdownEditor.tsx";

/** #114 deterministic RED for missing Markdown formatter/command contract. */
test("#114 Markdown exposes a deterministic formatter command", () => {
  expect(markdownPaneVisibility("split")).toEqual({ editor: true, preview: true });
  // Staging contract: formatter must be app-owned and deterministic.
  expect(false).toBe(true);
});
