import { expect, test } from "bun:test";
import { MONACO_ENGINE_NAME, monacoEngineStatus } from "../shared/monaco/MonacoEditorHost.tsx";

test("native Text and Markdown expose a stable visible Monaco runtime identity", () => {
  expect(MONACO_ENGINE_NAME).toBe("Monaco");
  expect(monacoEngineStatus(false)).toBe("Loading Monaco…");
  expect(monacoEngineStatus(true)).toBe("Monaco ready");
});
