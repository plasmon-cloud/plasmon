import { expect, test } from "bun:test";
import { createEditorSurfaceModelOwner, editorLanguageForName, syncEditorModelValue } from "./editorModel.ts";
import { monacoWorkerFile } from "./monacoEnvironment.ts";
class FakeModel { value = "hello"; replacements = 0; disposeCalls = 0; getValue() { return this.value; } setValue(value: string) { this.value = value; this.replacements += 1; } dispose() { this.disposeCalls += 1; } }
test("Monaco model is not reset when the saved document value is unchanged", () => { const model = new FakeModel(); expect(syncEditorModelValue(model, "hello")).toBe(false); expect(model.replacements).toBe(0); expect(syncEditorModelValue(model, "external replacement")).toBe(true); expect(model.replacements).toBe(1); });
test("two live Monaco surfaces for one semantic document own distinct models", () => {
  const createdUris: string[] = [];
  const create = (uri: string) => { createdUris.push(uri); return new FakeModel(); };
  const first = createEditorSurfaceModelOwner("node:shared-document", create);
  const second = createEditorSurfaceModelOwner("node:shared-document", create);

  expect(first.uri).not.toBe(second.uri);
  expect(createdUris).toEqual([first.uri, second.uri]);
  expect(first.model).not.toBe(second.model);

  first.dispose();
  expect(first.model.disposeCalls).toBe(1);
  expect(second.model.disposeCalls).toBe(0);
  expect(second.model.getValue()).toBe("hello");

  first.dispose();
  expect(first.model.disposeCalls).toBe(1);
  second.dispose();
  expect(second.model.disposeCalls).toBe(1);
});
test("Text chooses Monaco language modes from resource extensions", () => { expect(editorLanguageForName("demo.ts")).toBe("typescript"); expect(editorLanguageForName("view.tsx")).toBe("typescript"); expect(editorLanguageForName("readme.md")).toBe("markdown"); expect(editorLanguageForName("notes.txt")).toBe("plaintext"); expect(editorLanguageForName("unknown.datax")).toBe("plaintext"); });
test("Monaco worker routing stays local to packaged worker entrypoints", () => { expect(monacoWorkerFile("typescript")).toBe("ts.worker.js"); expect(monacoWorkerFile("json")).toBe("json.worker.js"); expect(monacoWorkerFile("css")).toBe("css.worker.js"); expect(monacoWorkerFile("html")).toBe("html.worker.js"); expect(monacoWorkerFile("editorWorkerService")).toBe("editor.worker.js"); });
