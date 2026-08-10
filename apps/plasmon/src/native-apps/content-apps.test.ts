import { expect, test } from "bun:test";
import { browserAppDefinition, contentAssociationRules, contentAppDefinitions, contentHandlerDefinitions, markdownAppDefinition, settingsAppDefinition, textAppDefinition, videoAppDefinition } from "./content-apps.ts";

test("native content metadata uses stable IDs and intended singleton choices", () => {
  expect(contentAppDefinitions.map((app) => app.id)).toEqual(["native:text", "native:markdown", "native:video", "native:browser", "native:settings"]);
  expect(textAppDefinition.singleton).toBe(false); expect(markdownAppDefinition.singleton).toBe(false); expect(videoAppDefinition.singleton).toBe(false); expect(browserAppDefinition.singleton).toBe(false); expect(settingsAppDefinition.singleton).toBe(true);
  expect(contentHandlerDefinitions.map((handler) => handler.id)).toContain("external:url");
});

test("association intent keeps Markdown specific over Text and URL/video IDs stable", () => {
  const md = contentAssociationRules.filter((rule) => rule.extensions?.includes(".md"));
  expect(md.find((rule) => rule.handlerId === "native:markdown")!.priority).toBeGreaterThan(md.find((rule) => rule.handlerId === "native:text")!.priority);
  expect(contentAssociationRules.some((rule) => rule.handlerId === "native:text" && rule.extensions?.includes(".txt"))).toBe(true);
  expect(contentAssociationRules.some((rule) => rule.handlerId === "native:video" && rule.mimeTypes?.includes("video/*"))).toBe(true);
  expect(contentAssociationRules.some((rule) => rule.handlerId === "native:browser" && rule.extensions?.includes(".url"))).toBe(true);
});
