import { expect, test } from "bun:test";
import { HandlerAssociationRegistry } from "../os/associations/registry.ts";
import type { FsNode } from "../os/contracts/index.ts";
import {
  browserAppDefinition,
  contentAssociationRules,
  contentAppDefinitions,
  contentHandlerDefinitions,
  markdownAppDefinition,
  photosAppDefinition,
  settingsAppDefinition,
  textAppDefinition,
  videoAppDefinition,
} from "./content-apps.ts";

function node(name: string, mime?: string): FsNode {
  return { id: `node:${name}`, parentId: "root", name, kind: "file", ...(mime ? { mime } : {}), size: 0, createdAt: 0, modifiedAt: 0, metadata: {} };
}

function registry(): HandlerAssociationRegistry {
  const result = new HandlerAssociationRegistry();
  for (const handler of contentHandlerDefinitions) result.registerHandler(handler);
  for (const rule of contentAssociationRules) result.registerRule(rule);
  return result;
}

test("native content metadata includes Photos and intended singleton choices", () => {
  expect(contentAppDefinitions.map((app) => app.id)).toEqual(["native:text", "native:markdown", "native:photos", "native:video", "native:browser", "native:settings"]);
  expect(textAppDefinition.singleton).toBe(false);
  expect(markdownAppDefinition.singleton).toBe(false);
  expect(photosAppDefinition.singleton).toBe(false);
  expect(videoAppDefinition.singleton).toBe(false);
  expect(browserAppDefinition.singleton).toBe(false);
  expect(settingsAppDefinition.singleton).toBe(true);
  expect(contentHandlerDefinitions.map((handler) => handler.id)).toContain("external:url");
});

test("Photos is the default handler for supported image extensions and MIME", async () => {
  const associations = registry();
  for (const resource of [node("face.png", "image/png"), node("photo.JPG", "image/jpeg"), node("diagram.svg", "image/svg+xml")]) {
    expect((await associations.getDefault(resource))?.id).toBe("native:photos");
  }
});

test("Markdown remains preferred while Text remains a compatible Open With handler", async () => {
  const handlers = await registry().resolve(node("README.md", "text/markdown"));
  expect(handlers[0]?.id).toBe("native:markdown");
  expect(handlers.map((handler) => handler.id)).toContain("native:text");
});

test("URL and video association IDs remain stable", () => {
  expect(contentAssociationRules.some((rule) => rule.handlerId === "native:video" && rule.mimeTypes?.includes("video/*"))).toBe(true);
  expect(contentAssociationRules.some((rule) => rule.handlerId === "native:browser" && rule.extensions?.includes(".url"))).toBe(true);
});
