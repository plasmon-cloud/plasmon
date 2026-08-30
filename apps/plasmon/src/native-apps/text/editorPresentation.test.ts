import { describe, expect, test } from "bun:test";
import { editorLanguageDisplayName, textEditorWindowTitle } from "./editorPresentation.ts";

describe("Text editor presentation", () => {
  test("uses document identity in the native process title", () => {
    expect(textEditorWindowTitle("notes.txt")).toBe("notes.txt - Monaco Editor");
    expect(textEditorWindowTitle("  ")).toBe("Untitled - Monaco Editor");
  });

  test("presents canonical Monaco language ids as user-facing modes", () => {
    expect(editorLanguageDisplayName("plaintext")).toBe("Plain Text");
    expect(editorLanguageDisplayName("javascript")).toBe("JavaScript");
    expect(editorLanguageDisplayName("typescript")).toBe("TypeScript");
    expect(editorLanguageDisplayName("custom-language")).toBe("custom-language");
  });

  test("identifies .cmd as Plasmon Command without claiming Bash compatibility", () => {
    expect(editorLanguageDisplayName("shell", "setup.cmd")).toBe("Plasmon Command (.cmd)");
    expect(editorLanguageDisplayName("shell", "setup.sh")).toBe("Shell");
  });
});
