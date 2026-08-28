import type { FilesystemSeedSpec } from "../os/fs/index.ts";

export const FIRST_DEMO_FIXTURE_PARAM = "plasmon-fixture";
export const FIRST_DEMO_FIXTURE_VALUE = "first-demo";

export const FIRST_DEMO_TEXT_PATH = "/Documents/First Demo Notes.txt";
export const FIRST_DEMO_MARKDOWN_PATH = "/Documents/First Demo Guide.md";
export const FIRST_DEMO_IMAGE_PATH = "/Pictures/First Demo Artwork.svg";

const FIRST_DEMO_TEXT = `Plasmon First Demo Notes

This document is authored for the Plasmon acceptance environment.
Use FileManager, Search, and Text Editor to discover and open it through normal filesystem associations.
`;

const FIRST_DEMO_MARKDOWN = `# Plasmon First Demo

This redistribution-safe Markdown fixture is authored in the Plasmon repository.

- Open it from FileManager or Search.
- Edit it with the native Markdown application.
- Keep demo content opt-in; normal production boot remains empty of these fixtures.
`;

const FIRST_DEMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="Plasmon first demo artwork">
  <rect width="960" height="540" fill="#121722"/>
  <circle cx="480" cy="270" r="150" fill="#73d6ff" opacity="0.22"/>
  <circle cx="480" cy="270" r="88" fill="#8af0c8" opacity="0.72"/>
  <path d="M188 336 C332 126 628 126 772 336" fill="none" stroke="#f0d27a" stroke-width="18" stroke-linecap="round"/>
  <text x="480" y="458" text-anchor="middle" font-family="system-ui, sans-serif" font-size="42" font-weight="700" fill="#f5f7fb">Plasmon First Demo</text>
</svg>`;

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

/** Normal production boot does not receive first-demo content. */
export function firstDemoFixtureRequested(pageUrl: string | URL): boolean {
  return new URL(pageUrl).searchParams.get(FIRST_DEMO_FIXTURE_PARAM) === FIRST_DEMO_FIXTURE_VALUE;
}

/**
 * Explicit acceptance/demo content expressed only through the production
 * filesystem seed contract. All bytes below are authored in this repository;
 * there are no third-party media payloads or game/runtime fixture ownership.
 */
export function createFirstDemoSeeds(pageUrl: string | URL): readonly FilesystemSeedSpec[] {
  if (!firstDemoFixtureRequested(pageUrl)) return [];

  return [
    {
      key: "demo.first.documents-directory.v1",
      seedClass: "demo-temporary",
      parentPath: "/",
      name: "Documents",
      kind: "directory",
    },
    {
      key: "demo.first.pictures-directory.v1",
      seedClass: "demo-temporary",
      parentPath: "/",
      name: "Pictures",
      kind: "directory",
    },
    {
      key: "demo.first.notes.v1",
      seedClass: "demo-temporary",
      parentPath: "/Documents",
      name: "First Demo Notes.txt",
      kind: "file",
      mime: "text/plain",
      bytes: encode(FIRST_DEMO_TEXT),
    },
    {
      key: "demo.first.guide.v1",
      seedClass: "demo-temporary",
      parentPath: "/Documents",
      name: "First Demo Guide.md",
      kind: "file",
      mime: "text/markdown",
      bytes: encode(FIRST_DEMO_MARKDOWN),
    },
    {
      key: "demo.first.artwork.v1",
      seedClass: "demo-temporary",
      parentPath: "/Pictures",
      name: "First Demo Artwork.svg",
      kind: "file",
      mime: "image/svg+xml",
      bytes: encode(FIRST_DEMO_SVG),
    },
  ];
}
