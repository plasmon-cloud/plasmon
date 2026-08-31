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

  test("identifies Plasmon script formats without claiming generic Bash or TypeScript", () => {
    expect(editorLanguageDisplayName("shell", "setup.cmd")).toBe("Plasmon Command (.cmd)");
    expect(editorLanguageDisplayName("typescript", "setup.run")).toBe("Plasmon Run (.run)");
    expect(editorLanguageDisplayName("shell", "setup.sh")).toBe("Shell");
    expect(editorLanguageDisplayName("typescript", "setup.ts")).toBe("TypeScript");
  });
});
