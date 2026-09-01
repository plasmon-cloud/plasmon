import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "../../../../");
const read = (relativePath: string) => readFileSync(resolve(appRoot, relativePath), "utf8");

test("Text and Markdown consume one shared Monaco host", () => {
  const text = read("src/native-apps/text/TextEditor.tsx");
  const markdown = read("src/native-apps/markdown/MarkdownEditor.tsx");
  expect(text).toContain("../shared/monaco/MonacoEditorHost.tsx");
  expect(markdown).toContain("../shared/monaco/MonacoEditorHost.tsx");
  expect(text).not.toContain("./MonacoEditorSurface");
  expect(markdown).not.toContain("../text/MonacoEditorSurface");
});

test("Text and Markdown consume one filesystem-backed minimap authority", () => {
  const text = read("src/native-apps/text/TextEditor.tsx");
  const markdown = read("src/native-apps/markdown/MarkdownEditor.tsx");
  for (const source of [text, markdown]) {
    expect(source).toContain("useMonacoRuntimeConfig");
    expect(source).toContain("runtimeConfig.editor.minimap.enabled");
    expect(source).toContain("setMinimapEnabled(!minimap)");
    expect(source).not.toContain("setMinimap((current)");
  }
});

test("shared Monaco host does not absorb document or Process authority", () => {
  const host = read("src/native-apps/shared/monaco/MonacoEditorHost.tsx");
  expect(host).not.toContain("FsService");
  expect(host).not.toContain("ProcessController");
  expect(host).not.toContain("useDocumentSession");
  expect(host).not.toContain("saveAs(");
});

test("Text keeps one Monaco surface while Save As rebinds filesystem identity", () => {
  const text = read("src/native-apps/text/TextEditor.tsx");
  expect(text).toContain('modelKey={`text:${processId}`}');
  expect(text).not.toContain("snapshot.nodeId ?? target.nodeId");
});

test("shared Monaco host exposes the actual live model language and identity", () => {
  const host = read("src/native-apps/shared/monaco/MonacoEditorHost.tsx");
  expect(host).toContain('data-editor-language={modelLanguage ?? ""}');
  expect(host).toContain('data-editor-model-uri={modelUri ?? ""}');
  expect(host).toContain("setModelLanguage(model.getLanguageId())");
  expect(host).toContain("syncEditorModelLanguage(");
  expect(host).toContain("updateMonacoEditorOptions(editor, { readOnly, ariaLabel, minimap, wordWrap })");
});
