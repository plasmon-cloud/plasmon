import { expect, test } from "bun:test";
import { contentHandlerDefinitions, contentAppDefinitions } from "../../../src/native-apps/content-apps.ts";

/** #96 deterministic RED: user-launchable app identity still uses generated glyph data URIs. */
test("#96 user-launchable native apps use packaged identity assets rather than generated glyphs", () => {
  const userApps = new Set(contentAppDefinitions.map((app) => app.handlerId));
  const handlers = contentHandlerDefinitions.filter((handler) => userApps.has(handler.id));
  expect(handlers.length).toBeGreaterThan(0);
  for (const handler of handlers) {
    expect(handler.icon, `${handler.id} must reference a packaged identity asset`).not.toMatch(/^data:image\/svg\+xml/u);
  }
});
