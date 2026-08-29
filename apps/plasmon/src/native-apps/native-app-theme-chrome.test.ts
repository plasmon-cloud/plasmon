// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS } from "./packaging.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const nativeAppThemeAudit = {
  Text: {
    source: "./text/TextEditor.tsx",
    markers: ["NativeAppContentSurface", "NativeAppToolbar", "NativeAppStatusStrip"],
  },
  Markdown: {
    source: "./markdown/MarkdownEditor.tsx",
    markers: ["NativeAppContentSurface", "NativeAppToolbar", "NativeAppStatusStrip"],
  },
  Photos: {
    source: "./photos/Photos.tsx",
    markers: ["NativeAppContentSurface", "NativeAppToolbar", "NativeAppStatusStrip"],
  },
  Video: {
    source: "./video/VideoPlayer.tsx",
    markers: ["NativeAppContentSurface", "NativeAppStatusStrip"],
  },
  Browser: {
    source: "./browser/Browser.tsx",
    markers: [
      "--plasmon-window-background",
      "--plasmon-panel-elevated",
      "--plasmon-control-background",
      "--plasmon-text-primary",
    ],
  },
  Settings: {
    source: "./settings/Settings.tsx",
    markers: ["NativeAppContentSurface", "NativeAppPanel", "--plasmon-text-primary"],
  },
  Explorer: {
    source: "../os/file-manager/file-manager.scss",
    markers: [
      ".explorer-app {",
      "background: var(--plasmon-window-background)",
      "background: var(--plasmon-panel-background)",
      "background: var(--plasmon-control-background)",
    ],
  },
  Properties: {
    source: "../os/file-manager/file-manager.scss",
    markers: [
      ".native-properties-app {",
      "background: var(--plasmon-window-background)",
      "color: var(--plasmon-text-primary)",
    ],
  },
  "Recycle Bin": {
    source: "./recycle-bin/recycle-bin.scss",
    markers: [
      "--plasmon-window-background",
      "--plasmon-panel-elevated",
      "--plasmon-control-background",
      "--plasmon-text-primary",
    ],
  },
} as const;

test("#511 every packaged first-party native app has an explicit theme-chrome contract", () => {
  const packaged = FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS.map(({ name }) => name).sort();
  const audited = Object.keys(nativeAppThemeAudit).sort();
  expect(audited).toEqual(packaged);

  for (const [name, audit] of Object.entries(nativeAppThemeAudit)) {
    const source = read(audit.source);
    for (const marker of audit.markers) {
      expect(source, `${name} should consume theme-aware first-party chrome`).toContain(marker);
    }
  }
});

test("#511 first-party Browser chrome uses the Visual palette while web content stays unmodified", () => {
  const source = read("./browser/Browser.tsx");

  for (const token of [
    "--plasmon-window-background",
    "--plasmon-panel-elevated",
    "--plasmon-panel-background",
    "--plasmon-control-background",
    "--plasmon-border-strong",
    "--plasmon-text-primary",
    "--plasmon-text-secondary",
    "--plasmon-text-disabled",
    "--plasmon-accent",
    "--plasmon-danger",
  ]) {
    expect(source).toContain(token);
  }

  for (const fixedChromeColor of [
    "#171a1f",
    "#20242a",
    "#111419",
    "#343a43",
    "#252a31",
    "#29171a",
  ]) {
    expect(source).not.toContain(fixedChromeColor);
  }

  // The iframe is arbitrary web content, not a Plasmon-owned themed surface.
  expect(source).toContain('background: "#fff"');
});

test("#511 Recycle Bin consumes current Visual semantics instead of dark local fallbacks", () => {
  const source = read("./recycle-bin/recycle-bin.scss");

  for (const token of [
    "--plasmon-window-background",
    "--plasmon-panel-elevated",
    "--plasmon-control-background",
    "--plasmon-control-hover",
    "--plasmon-border-subtle",
    "--plasmon-border-strong",
    "--plasmon-text-primary",
    "--plasmon-text-secondary",
    "--plasmon-text-subtle",
    "--plasmon-text-disabled",
    "--plasmon-selection",
    "--plasmon-focus-ring",
    "--plasmon-danger",
  ]) {
    expect(source).toContain(token);
  }

  for (const retiredLocalToken of [
    "--plasmon-panel,",
    "--plasmon-border,",
    "--plasmon-muted,",
  ]) {
    expect(source).not.toContain(retiredLocalToken);
  }

  for (const fixedDarkSurface of [
    "#111722",
    "#171f2c",
    "#1a2230",
    "#172131",
    "#1d3048",
    "#351d22",
  ]) {
    expect(source).not.toContain(fixedDarkSurface);
  }
});

test("#511 preserves dedicated media/content stages rather than recoloring user content", () => {
  const photos = read("./photos/Photos.tsx");
  const video = read("./video/VideoPlayer.tsx");

  expect(photos).toContain('background: "#111315"');
  expect(video).toContain('background: "#000"');
});
