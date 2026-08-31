// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const overlay = readFileSync(new URL("./desktop-overlays.scss", import.meta.url), "utf8");

test("watermark is composed by the wallpaper layer below workspace content", () => {
  expect(overlay).toContain('.plasmon-shell[data-plasmon-brand-watermark="visible"] > .plasmon-shell__wallpaper::after');
  expect(overlay).toContain('url("static/plasmon/plasmon-watermark.svg")');
  expect(overlay).toContain("bottom: calc(var(--plasmon-taskbar-height) + 24px)");
  expect(overlay).toContain("height: 63px");
  expect(overlay).toContain("opacity: .3");
  expect(overlay).toContain("pointer-events: none");
  expect(overlay).toContain("right: 24px");
  expect(overlay).toContain("width: 264px");
  expect(overlay).not.toContain("z-index");
  expect(overlay).not.toContain("--plasmon-shell-z-desktop-overlay");
});
