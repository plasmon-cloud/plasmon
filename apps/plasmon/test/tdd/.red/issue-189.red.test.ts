import { expect, test } from "bun:test";
import { classifyResource, NEUTRON_APP_MIME, SYSTEM_APP_MIME, systemAppMetadata, neutronAppMetadata } from "../../../src/os/fs/index.ts";
import { categorizeFsNode } from "../../../src/os/shell/search.ts";
import { fileVisualKind } from "../../../src/os/file-manager/file-icons.ts";
import type { FsNode } from "../../../src/os/contracts/index.ts";

const node = (name: string, input: Partial<FsNode> = {}): FsNode => ({
  id: `node:${name}`,
  parentId: "root",
  name,
  kind: "file",
  size: 1,
  createdAt: 0,
  modifiedAt: 0,
  metadata: {},
  ...input,
});

test("#189 RED — explicit MIME metadata outranks extension guesses across FileManager classification", () => {
  const markdownNameWithPlainMime = node("notes.md", { mime: "text/plain" });
  const plainNameWithMarkdownMime = node("notes.txt", { mime: "text/markdown" });

  expect(fileVisualKind(markdownNameWithPlainMime), "an explicit MIME must not be overridden by .md").toBe("text");
  expect(fileVisualKind(plainNameWithMarkdownMime), "an explicit MIME must classify markdown regardless of suffix").toBe("markdown");
});

test("#189 RED — canonical system resource semantics reach Search rather than the generic documents bucket", () => {
  const system = node("Text.sys", {
    mime: SYSTEM_APP_MIME,
    metadata: systemAppMetadata("text", "native:text"),
  });
  const neutron = node("Review.neutron", {
    mime: NEUTRON_APP_MIME,
    metadata: neutronAppMetadata({ elementId: "review", name: "Review" }),
  });

  expect(classifyResource(system).kind).toBe("system-app");
  expect(categorizeFsNode(system), "system applications must not leak into documents/media search").toBe("apps");
  expect(classifyResource(neutron).kind).toBe("neutron-app");
  expect(categorizeFsNode(neutron)).toBe("apps");
});

test("#189 characterization — rename changes only derived classification while identity remains stable", () => {
  const before = node("guide.txt", { id: "stable-guide", mime: undefined });
  const after = { ...before, name: "guide.md" };
  expect(before.id).toBe(after.id);
  expect(fileVisualKind(before)).toBe("text");
  expect(fileVisualKind(after)).toBe("markdown");
});
