// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./adaptive-surfaces.scss", import.meta.url), "utf8");

test("desktop wallpaper labels keep the #620 default and use only fixed readability variants", () => {
  expect(css).toContain(".fm-entry--desktop:not(.is-renaming) .fm-entry__name");
  expect(css).toContain(".fm-entry--desktop .fm-entry__expanded-name");
  expect(css).toContain("var(--plasmon-wallpaper-label-ink)");
  expect(css).toContain("0 1px 2px rgb(0 0 0 / 92%)");
  expect(css).toContain("0 0 4px rgb(0 0 0 / 68%)");
  expect(css).toContain('data-plasmon-visual-label-readability="strong"');
  expect(css).toContain('data-plasmon-visual-label-readability="maximum"');
  expect(css).not.toContain(".fm-entry--desktop.is-renaming .fm-entry__name");
});

test("transparency checker keeps the #621 default and maps bounded semantic variants", () => {
  expect(css).toContain("var(--plasmon-window-background) 92%");
  expect(css).toContain("var(--plasmon-text-primary) 8%");
  expect(css).toContain("var(--plasmon-window-background) 82%");
  expect(css).toContain("var(--plasmon-text-primary) 18%");
  expect(css).toContain("--plasmon-transparency-check-size: 8px");
  expect(css).toContain('data-plasmon-visual-checker-intensity="subtle"');
  expect(css).toContain('data-plasmon-visual-checker-intensity="strong"');
  expect(css).toContain('data-plasmon-visual-checker-pattern="fine"');
  expect(css).toContain('data-plasmon-visual-checker-pattern="coarse"');
  expect(css).toContain(".plasmon-icon-frame--thumbnail");
  expect(css).toContain(".plasmon-native-app-surface[data-photos-display-mode] img");
  expect(css).toContain("var(--plasmon-transparency-check-size)");
  expect(css).not.toContain("data-plasmon-theme");
});