import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "../../../../");
const read = (relativePath: string) => readFileSync(resolve(appRoot, relativePath), "utf8");

test("#200 Text and Markdown consume one shared Monaco host", () => {
  const text = read("src/native-apps/text/TextEditor.tsx");
  const markdown = read("src/native-apps/markdown/MarkdownEditor.tsx");
  expect(text).toContain("../shared/monaco/MonacoEditorHost.tsx");
  expect(markdown).toContain("../shared/monaco/MonacoEditorHost.tsx");
  expect(text).not.toContain("./MonacoEditorSurface");
  expect(markdown).not.toContain("../text/MonacoEditorSurface");
});

test("#200 shared Monaco host does not absorb document or Process authority", () => {
  const host = read("src/native-apps/shared/monaco/MonacoEditorHost.tsx");
  expect(host).not.toContain("FsService");
  expect(host).not.toContain("ProcessController");
  expect(host).not.toContain("useDocumentSession");
  expect(host).not.toContain("saveAs(");
});
