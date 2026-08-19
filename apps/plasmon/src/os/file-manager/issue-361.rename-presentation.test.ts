import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const polish = readFileSync(new URL("./polish.scss", import.meta.url), "utf8");
const fileEntry = readFileSync(new URL("./FileEntry.tsx", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = polish.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`Missing style rule: ${selector}`);
  return match[1] ?? "";
}

test("#361 inline rename editor is a bounded wrapping textarea", () => {
  const editor = rule(".fm-entry.is-renaming .fm-entry__name textarea");
  expect(fileEntry).toContain("<textarea");
  expect(fileEntry).toContain("rows={1}");
  expect(editor).toContain("width: 100%");
  expect(editor).toContain("max-width: 100%");
  expect(editor).toContain("min-width: 0");
  expect(editor).toContain("resize: none");
});

test("#361 Desktop and Grid rename wrap long names vertically instead of widening horizontally", () => {
  const tileEditor = rule(".fm-entry--desktop.is-renaming .fm-entry__name textarea,\n.fm-entry--grid.is-renaming .fm-entry__name textarea");
  expect(tileEditor).toContain("white-space: pre-wrap");
  expect(tileEditor).toContain("overflow-x: hidden");
  expect(tileEditor).toContain("overflow-wrap: anywhere");
  expect(tileEditor).toContain("max-height: calc(10em + 8px)");
  expect(fileEntry).toContain('editor.style.height = "0px"');
  expect(fileEntry).toContain("editor.scrollHeight");
});

test("#361 preserves the completed #95 selected Desktop expanded-label contract", () => {
  const selected = rule(".fm-entry--desktop .fm-entry__expanded-name");
  expect(selected).toContain("--fm-desktop-label-width: min(260px, calc(100cqi - 16px))");
  expect(selected).toContain("width: var(--fm-desktop-label-width)");
  expect(selected).toContain("max-width: none");
});

test("#361 Desktop rename wrapper is compact and workspace-clamped without reusing #95 width", () => {
  const desktop = rule(".fm-entry--desktop.is-renaming .fm-entry__name");
  expect(desktop).toContain("--fm-desktop-rename-width: min(112px, calc(100cqi - 16px))");
  expect(desktop).toContain("calc(8px - var(--fm-desktop-entry-x))");
  expect(desktop).toContain("-10px");
  expect(desktop).toContain("calc(100cqi - 8px - var(--fm-desktop-entry-x) - var(--fm-desktop-rename-width))");
  expect(desktop).toContain("width: var(--fm-desktop-rename-width)");
  expect(desktop).toContain("max-width: none");
  expect(desktop).toContain("padding: 0");
  expect(desktop).toContain("border: 0");
  expect(desktop).toContain("background: transparent");
  expect(desktop).not.toContain("260px");
});

test("#361 Grid rename is an overlay so long editor growth cannot reflow neighboring entries", () => {
  const grid = rule(".fm-entry--grid.is-renaming .fm-entry__name");
  expect(grid).toContain("position: absolute");
  expect(grid).toContain("width: calc(100% - 12px)");
  expect(grid).toContain("overflow: visible");
});

test("#361 wrapped editor does not clip shared rename error presentation", () => {
  const error = rule(".fm-entry.is-renaming .fm-inline-error");
  expect(error).toContain("white-space: normal");
  expect(error).toContain("overflow-wrap: anywhere");
});
