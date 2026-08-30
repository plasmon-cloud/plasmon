import { expect, test } from "bun:test";
import { recycleBinKindLabel } from "./model.ts";

test("Recycle Bin shortcut rows render a descriptive kind without punctuation artifacts", () => {
  expect(recycleBinKindLabel("shortcut")).toBe("Shortcut");
  expect(recycleBinKindLabel("shortcut")).not.toMatch(/^\W+$/u);
});

test("Recycle Bin kind labels stay aligned across ordinary resource kinds", () => {
  expect([
    recycleBinKindLabel("directory"),
    recycleBinKindLabel("file"),
    recycleBinKindLabel("shortcut"),
    recycleBinKindLabel("atom"),
  ]).toEqual(["Folder", "File", "Shortcut", "Atom"]);
});
