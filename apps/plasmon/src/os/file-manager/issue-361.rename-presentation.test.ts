import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const polish = readFileSync(new URL("./polish.scss", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = polish.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`Missing style rule: ${selector}`);
  return match[1] ?? "";
}

test("#361 inline rename input owns a bounded single-line editing box", () => {
  const input = rule(".fm-entry.is-renaming .fm-entry__name input");
  expect(input).toContain("width: 100%");
  expect(input).toContain("max-width: 100%");
  expect(input).toContain("min-width: 0");
  expect(input).toContain("white-space: nowrap");
  expect(input).toContain("overflow: hidden");
  expect(input).toContain("padding-inline: 3px");
});

test("#361 Desktop rename wrapper does not consume editor width with a second padded box", () => {
  const desktop = rule(".fm-entry--desktop.is-renaming .fm-entry__name");
  expect(desktop).toContain("width: 100%");
  expect(desktop).toContain("max-width: 100%");
  expect(desktop).toContain("padding: 0");
  expect(desktop).toContain("border: 0");
  expect(desktop).toContain("background: transparent");
  expect(desktop).toContain("overflow-wrap: normal");
});

test("#361 input clipping does not clip shared rename error presentation", () => {
  const renameParent = rule(".fm-entry.is-renaming .fm-entry__name");
  const error = rule(".fm-entry.is-renaming .fm-inline-error");
  expect(renameParent).toContain("overflow: visible");
  expect(error).toContain("white-space: normal");
  expect(error).toContain("overflow-wrap: anywhere");
});

test("#361 selected Grid wrapping excludes the active rename editor", () => {
  expect(polish).toContain(".fm-entry--grid.is-selected:not(.is-renaming) .fm-entry__name");
});
