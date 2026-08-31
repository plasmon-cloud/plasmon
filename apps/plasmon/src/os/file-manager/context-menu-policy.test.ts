import { expect, test } from "bun:test";
import type { FsNode } from "../contracts/index.ts";
import { shouldShowPersonalizeMenuItem } from "./FileManagerContextMenu.tsx";

const fileNode = {
  id: "file:1",
  parentId: "desktop",
  name: "note.txt",
  kind: "file",
  size: 0,
  createdAt: 0,
  modifiedAt: 0,
  metadata: {},
} as FsNode;

test("Personalize is exposed only for an enabled background menu", () => {
  expect(shouldShowPersonalizeMenuItem(null, true)).toBe(true);
  expect(shouldShowPersonalizeMenuItem(null, false)).toBe(false);
  expect(shouldShowPersonalizeMenuItem(fileNode, true)).toBe(false);
});
