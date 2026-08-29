import { expect, test } from "bun:test";
import { HandlerAssociationRegistry } from "../../../src/os/associations/index.ts";
import type { FsNode, HandlerDefinition } from "../../../src/os/contracts/index.ts";
import { fileVisualKind } from "../../../src/os/file-manager/file-icons.ts";
import { friendlyKind } from "../../../src/os/file-manager/properties.tsx";
import { classifyResource, NEUTRON_APP_MIME, SYSTEM_APP_MIME, systemAppMetadata, neutronAppMetadata } from "../../../src/os/fs/index.ts";
import { categorizeFsNode } from "../../../src/os/shell/search.ts";
import { inferImageMime } from "../../../src/native-apps/photos/media.ts";
import { editorLanguageForResource } from "../../../src/native-apps/shared/monaco/editorModel.ts";
import { inferVideoMime } from "../../../src/native-apps/video/media.ts";

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

test("RED — explicit MIME metadata outranks extension guesses across FileManager classification", () => {
  const markdownNameWithPlainMime = node("notes.md", { mime: "text/plain" });
  const plainNameWithMarkdownMime = node("notes.txt", { mime: "text/markdown" });

  expect(fileVisualKind(markdownNameWithPlainMime), "an explicit MIME must not be overridden by .md").toBe("text");
  expect(fileVisualKind(plainNameWithMarkdownMime), "an explicit MIME must classify markdown regardless of suffix").toBe("markdown");
});

test("RED — canonical system resource semantics reach Search rather than the generic documents bucket", () => {
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

test("characterization — rename changes only derived classification while identity remains stable", () => {
  const before = node("guide.txt", { id: "stable-guide", mime: undefined });
  const after = { ...before, name: "guide.md" };
  expect(before.id).toBe(after.id);
  expect(classifyResource(before).type).toMatchObject({ mime: "text/plain", contentKind: "text", source: "filename" });
  expect(classifyResource(after).type).toMatchObject({ mime: "text/markdown", contentKind: "markdown", source: "filename" });
});

test("canonical classifier covers representative derived families and safe unknown fallback", () => {
  expect(classifyResource(node("notes.txt")).type).toMatchObject({ mime: "text/plain", contentKind: "text", source: "filename" });
  expect(classifyResource(node("app.ts")).type).toMatchObject({ mime: "text/typescript", contentKind: "source", language: "typescript" });
  expect(classifyResource(node("README.md")).type).toMatchObject({ mime: "text/markdown", contentKind: "markdown", language: "markdown" });
  expect(classifyResource(node("photo.png")).type).toMatchObject({ mime: "image/png", contentKind: "image" });
  expect(classifyResource(node("song.mp3")).type).toMatchObject({ mime: "audio/mpeg", contentKind: "audio" });
  expect(classifyResource(node("movie.webm")).type).toMatchObject({ mime: "video/webm", contentKind: "video" });
  expect(classifyResource(node("mystery.blob")).type).toMatchObject({ mime: null, contentKind: "unknown", source: "fallback" });
  expect(classifyResource(node("folder", { kind: "directory" })).kind).toBe("directory");
});

test("compatibility — generic text/plain is weaker than a known source filename, while specific MIME remains explicit", () => {
  expect(classifyResource(node("script.js", { mime: "text/plain" })).type).toMatchObject({
    mime: "application/javascript",
    contentKind: "source",
    language: "javascript",
    source: "filename",
  });
  expect(classifyResource(node("script.js", { mime: "text/plain; charset=utf-8" })).type).toMatchObject({
    mime: "application/javascript",
    language: "javascript",
    source: "filename",
  });
  expect(classifyResource(node("script.js", { mime: "application/octet-stream" })).type).toMatchObject({
    mime: "application/octet-stream",
    contentKind: "unknown",
    source: "explicit-mime",
  });
  expect(classifyResource(node("README.md", { mime: "text/plain" })).type).toMatchObject({
    mime: "text/plain",
    contentKind: "text",
    language: "plaintext",
    source: "explicit-mime",
  });
});

test("RED — Properties, Text, Photos, and Video consume the same explicit-over-derived type precedence", () => {
  expect(friendlyKind(node("script.js"))).toBe("application/javascript");
  expect(friendlyKind(node("script.js", { mime: "text/plain" }))).toBe("application/javascript");
  expect(friendlyKind(node("script.js", { mime: "application/octet-stream" }))).toBe("application/octet-stream");
  expect(editorLanguageForResource("script.js", "text/plain")).toBe("javascript");
  expect(editorLanguageForResource("README.md", "text/plain")).toBe("plaintext");
  expect(inferImageMime("poster.png")).toBe("image/png");
  expect(inferImageMime("poster.png", "application/octet-stream")).toBeNull();
  expect(inferVideoMime("movie.mp4")).toBe("video/mp4");
  expect(inferVideoMime("movie.mp4", "application/octet-stream")).toBe("application/octet-stream");
});

test("AssociationRegistry remains an independent handler-matching authority", async () => {
  const registry = new HandlerAssociationRegistry();
  const handler: HandlerDefinition = {
    id: "native:markdown",
    kind: "native",
    name: "Markdown",
    icon: "system:test",
    capabilities: ["read"],
  };
  registry.registerHandler(handler);
  registry.registerRule({ id: "markdown-by-extension", handlerId: handler.id, extensions: [".md"], priority: 1 });

  const resource = node("notes.md", { mime: "text/plain" });
  expect(classifyResource(resource).type.contentKind).toBe("text");
  expect((await registry.resolve(resource)).map((candidate) => candidate.id)).toEqual([handler.id]);
});
