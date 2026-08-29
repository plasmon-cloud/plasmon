import { describe, expect, test } from "bun:test";
import {
  createEditorSurfaceModelOwner,
  editorLanguageForResource,
  editorModelUri,
  syncEditorModelLanguage,
  syncEditorModelValue,
} from "./editorModel.ts";
import {
  MONACO_PROGRAM_FILES_RUNTIME_ROOT,
  monacoWorkerBootstrapSource,
  monacoWorkerFile,
  monacoWorkerPath,
} from "./monacoEnvironment.ts";

describe("shared Monaco editor-host policy", () => {
  test("live surfaces get distinct model ownership even for one semantic document", () => {
    const disposed: string[] = [];
    const create = (uri: string) => ({ uri, dispose: () => disposed.push(uri) });
    const first = createEditorSurfaceModelOwner("document:42", create);
    const second = createEditorSurfaceModelOwner("document:42", create);

    expect(first.uri).not.toBe(second.uri);
    expect(first.uri).toContain(encodeURIComponent("document:42"));
    expect(second.uri).toContain(encodeURIComponent("document:42"));
    first.dispose();
    first.dispose();
    expect(disposed).toEqual([first.uri]);
    second.dispose();
    expect(disposed).toEqual([first.uri, second.uri]);
  });

  test("semantic model URIs remain deterministic for an explicit surface identity", () => {
    expect(editorModelUri("text:node-7", 3)).toBe("inmemory://plasmon/text%3Anode-7?surface=3");
  });

  test("external value synchronization does not write unchanged content", () => {
    let value = "same";
    let writes = 0;
    const model = {
      getValue: () => value,
      setValue: (next: string) => { value = next; writes += 1; },
    };
    expect(syncEditorModelValue(model, "same")).toBe(false);
    expect(syncEditorModelValue(model, "next")).toBe(true);
    expect(writes).toBe(1);
  });

  test("live language synchronization changes the existing model in place", () => {
    let language = "plaintext";
    const model = { getLanguageId: () => language };
    const transitions: string[] = [];
    const setModelLanguage = (target: typeof model, next: string) => {
      expect(target).toBe(model);
      transitions.push(next);
      language = next;
    };

    expect(syncEditorModelLanguage(model, "javascript", setModelLanguage)).toBe(true);
    expect(model.getLanguageId()).toBe("javascript");
    expect(syncEditorModelLanguage(model, "javascript", setModelLanguage)).toBe(false);
    expect(syncEditorModelLanguage(model, "plaintext", setModelLanguage)).toBe(true);
    expect(model.getLanguageId()).toBe("plaintext");
    expect(transitions).toEqual(["javascript", "plaintext"]);
  });

  test("language selection consumes canonical resource classification", () => {
    expect(editorLanguageForResource("example.js")).toBe("javascript");
    expect(editorLanguageForResource("example.js", "application/javascript")).toBe("javascript");
    expect(editorLanguageForResource("example.js", "text/plain")).toBe("javascript");
    expect(editorLanguageForResource("example.js", "application/octet-stream")).toBe("plaintext");
    expect(editorLanguageForResource("notes.md", "text/plain")).toBe("plaintext");
    expect(editorLanguageForResource("notes.md", "text/markdown")).toBe("markdown");
    expect(editorLanguageForResource("plain.unknown")).toBe("plaintext");
  });

  test("worker routing stays on #89 canonical Program Files authority", () => {
    expect(monacoWorkerFile("typescript")).toBe("ts.worker.js");
    expect(monacoWorkerPath("typescript")).toBe(`${MONACO_PROGRAM_FILES_RUNTIME_ROOT}/ts.worker.js`);
    expect(monacoWorkerFile("unknown")).toBe("editor.worker.js");
  });

  test("opaque-origin bootstrap fails explicitly when packaged worker bytes are missing", () => {
    expect(monacoWorkerBootstrapSource("json", { "json.worker.js": "self.onmessage = () => {};" }))
      .toContain("self.onmessage");
    expect(() => monacoWorkerBootstrapSource("json", {})).toThrow("Missing packaged Monaco worker source: json.worker.js");
  });
});
