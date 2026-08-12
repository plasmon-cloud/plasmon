// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { FsNode, FsNodeKind } from "../contracts/index.ts";
import { fileVisualKind, resourceIconPresentationForFile } from "./file-icons.ts";

function node(name: string, kind: FsNodeKind = "file", mime?: string): FsNode {
  return {
    id: `node:${name}`,
    parentId: "root",
    name,
    kind,
    ...(mime ? { mime } : {}),
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

test("Properties resource presentation maps FileManager semantic kinds to shared artwork", () => {
  expect(resourceIconPresentationForFile(node("Folder", "directory"))).toEqual({ kind: "file-type", icon: "folder" });
  expect(resourceIconPresentationForFile(node("notes.txt", "file", "text/plain"))).toEqual({ kind: "file-type", icon: "text" });
  expect(resourceIconPresentationForFile(node("README.md", "file", "text/markdown"))).toEqual({ kind: "file-type", icon: "markdown" });
  expect(resourceIconPresentationForFile(node("photo.png", "file", "image/png"))).toEqual({ kind: "file-type", icon: "image" });
  expect(resourceIconPresentationForFile(node("movie.webm", "file", "video/webm"))).toEqual({ kind: "file-type", icon: "video" });
  expect(resourceIconPresentationForFile(node("review.atom", "atom"))).toEqual({ kind: "file-type", icon: "atom" });
  expect(resourceIconPresentationForFile(node("opaque.bin"))).toEqual({ kind: "file-type", icon: "file" });
});

test("shortcut classification remains upstream of shared visual composition", () => {
  const shortcut = node("Docs", "shortcut");
  expect(fileVisualKind(shortcut)).toBe("shortcut");
  expect(resourceIconPresentationForFile(shortcut)).toEqual({ kind: "file-type", icon: "file" });
});
