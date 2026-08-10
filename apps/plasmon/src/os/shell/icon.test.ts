// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import {
  resolveShellIconPresentation,
  shellIconInitials,
} from "./icon.tsx";

test("broken image URL falls back to clean initials", () => {
  const src = "https://example.invalid/icon.svg";
  expect(resolveShellIconPresentation(src, "Neutron Mail", src)).toEqual({
    kind: "fallback",
    text: "NM",
  });
});

test("successful image reference remains an image presentation", () => {
  const src = "/apps/mail/static/icon.svg";
  expect(resolveShellIconPresentation(src, "Mail", null)).toEqual({
    kind: "image",
    src,
  });
});

test("symbolic native icon remains a stable fallback and initials are bounded", () => {
  expect(resolveShellIconPresentation("M↓", "Markdown", null)).toEqual({
    kind: "fallback",
    text: "M↓",
  });
  expect(shellIconInitials("Very Long Application Name")).toBe("VL");
});
