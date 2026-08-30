// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { SHELL_THEME_IDS } from "../shell/preferences.ts";

test("FileManager transient chrome follows the active Visual palette", () => {
  const themeSurfaces = readFileSync(new URL("./theme-surfaces.scss", import.meta.url), "utf8");
  const rootStyle = readFileSync(new URL("../../style.scss", import.meta.url), "utf8");

  expect(rootStyle).toContain('@use "./os/file-manager/theme-surfaces.scss";');
  expect(themeSurfaces).toContain("[data-plasmon-theme] .fm-entry--desktop .fm-entry__expanded-name");
  expect(themeSurfaces).toContain("background: var(--plasmon-panel-elevated)");
  expect(themeSurfaces).toContain("border-color: var(--plasmon-selection-border)");
  expect(themeSurfaces).toContain("background: var(--plasmon-control-background)");
  expect(themeSurfaces).toContain("background: var(--plasmon-accent)");
  expect(themeSurfaces).toContain("border-color: var(--plasmon-danger)");
  expect(themeSurfaces).not.toContain(".fm-entry__icon--");

  for (const fixedDark of ["#101a2a", "rgba(18,27,43,.96)", "#172238", "#397be2"]) {
    expect(themeSurfaces).not.toContain(fixedDark);
  }
});

test("File Manager view dropdown consumes semantic states shared by every supported theme", () => {
  const themeSurfaces = readFileSync(new URL("./theme-surfaces.scss", import.meta.url), "utf8");

  expect(SHELL_THEME_IDS).toEqual([
    "plasmon-graphite",
    "plasmon-verdant",
    "plasmon-midnight",
    "plasmon-ember",
    "plasmon-glacier",
    "plasmon-rosewood",
  ]);
  expect(themeSurfaces).toContain(".explorer-app__viewbar select option");
  expect(themeSurfaces).toContain("background: var(--plasmon-control-background)");
  expect(themeSurfaces).toContain("background: var(--plasmon-control-hover)");
  expect(themeSurfaces).toContain("background: var(--plasmon-selection)");
  expect(themeSurfaces).toContain("color: var(--plasmon-text-primary)");
  expect(themeSurfaces).toContain("color: var(--plasmon-text-disabled)");
  expect(themeSurfaces).toContain("outline: 2px solid var(--plasmon-focus-ring)");
  expect(themeSurfaces).not.toMatch(/(?:background|color|border(?:-color)?):\s*(?:#|rgb|hsl|white\b|black\b)/iu);
});
