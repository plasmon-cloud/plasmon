import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  contentAppDefinitions,
  contentHandlerDefinitions,
} from "./content-apps.ts";

const FIRST_PARTY_APPS = [
  "native:text",
  "native:markdown",
  "native:photos",
  "native:video",
  "native:browser",
  "native:settings",
] as const;

function packageAssetPath(reference: string): string {
  const relative = reference.replace(/^\/+/, "");
  return fileURLToPath(new URL(`../../public/${relative}`, import.meta.url));
}

test("#96 first-party application identities are packaged metadata, not generated glyph data URIs", () => {
  const apps = contentAppDefinitions.filter((app) =>
    FIRST_PARTY_APPS.includes(app.id as (typeof FIRST_PARTY_APPS)[number]),
  );
  const handlers = contentHandlerDefinitions.filter((handler) =>
    FIRST_PARTY_APPS.includes(handler.id as (typeof FIRST_PARTY_APPS)[number]),
  );

  expect(apps.map((app) => app.id)).toEqual(FIRST_PARTY_APPS);
  expect(handlers.map((handler) => handler.id)).toEqual(FIRST_PARTY_APPS);
  expect(new Set(handlers.map((handler) => handler.icon)).size).toBe(FIRST_PARTY_APPS.length);

  for (const id of FIRST_PARTY_APPS) {
    const app = apps.find((candidate) => candidate.id === id)!;
    const handler = handlers.find((candidate) => candidate.id === id)!;

    expect(app.handlerId).toBe(handler.id);
    expect(app.icon).toBe(handler.icon);
    expect(handler.icon, `${id} must not publish generated icon pixels`).not.toMatch(
      /^(?:data:image\/|https?:)/u,
    );
    expect(handler.icon, `${id} must reference the shared packaged asset tree`).toMatch(
      /^\/?static\/plasmon\/icons\/[^/?#]+\.(?:svg|png|webp)$/u,
    );
    expect(existsSync(packageAssetPath(handler.icon))).toBe(true);
  }
});
