import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("FileEntry initial rename selection is session keyed, not controlled-value keyed", () => {
  const source = readFileSync(new URL("./FileEntry.tsx", import.meta.url), "utf8");
  expect(source).toContain("rename.session");
  expect(source).toContain("rename?.session");
  expect(source).not.toContain("rename?.value]");
  expect(source).toContain("renameSelectionRef.current.initialize(");
});

test("FileEntry handles Enter and Escape without blur re-committing the same action", () => {
  const source = readFileSync(new URL("./FileEntry.tsx", import.meta.url), "utf8");
  expect(source).toContain("suppressBlurCommitRef.current = true");
  expect(source).toContain("if (!rename.busy && !suppressBlurCommitRef.current) onRenameCommit()");
  expect(source).toContain('if (action === "commit") onRenameCommit()');
  expect(source).toContain("else onRenameCancel()");
});
