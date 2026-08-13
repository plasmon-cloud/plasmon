import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentClosePrompt } from "../../../src/native-apps/text/DocumentClosePrompt.tsx";

test("document close prompt is an app-local modal decision surface, not a native child window", () => {
  const markup = renderToStaticMarkup(<DocumentClosePrompt
    documentName="notes.txt"
    saving={false}
    status="ready"
    error={null}
    onSave={() => undefined}
    onDiscard={() => undefined}
    onCancel={() => undefined}
  />);
  expect(markup).toContain('role="alertdialog"');
  expect(markup).toContain('aria-modal="true"');
  expect(markup).toContain("Save changes to notes.txt?");
  expect(markup).toContain(">Save<");
  expect(markup).toContain(">Discard<");
  expect(markup).toContain(">Cancel<");
});
