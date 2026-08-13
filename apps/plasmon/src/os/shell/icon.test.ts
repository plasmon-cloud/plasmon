// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHORTCUT_OVERLAY_ASSET, SYSTEM_ICON_ASSETS } from "../visual/assets.ts";
import { ShellIcon } from "./icon.tsx";

test("Shell renders authoritative image artwork through shared Visual", () => {
  const markup = renderToStaticMarkup(createElement(ShellIcon, {
    icon: "/apps/mail/static/icon.svg",
    label: "Mail",
    context: "search",
  }));
  expect(markup).toContain("/apps/mail/static/icon.svg");
  expect(markup).toContain('data-icon-context="search"');
  expect(markup).toContain("object-fit:contain");
});

test("Shell missing artwork uses the shared application fallback rather than initials", () => {
  const markup = renderToStaticMarkup(createElement(ShellIcon, { label: "Neutron Mail" }));
  expect(markup).toContain(SYSTEM_ICON_ASSETS.application);
  expect(markup).not.toContain("NM");
});

test("Shell shortcut composition and taskbar sizing are delegated to shared Visual", () => {
  const markup = renderToStaticMarkup(createElement(ShellIcon, {
    icon: SYSTEM_ICON_ASSETS["file-manager"],
    label: "Files",
    shortcut: true,
    context: "taskbar",
  }));
  expect(markup).toContain(SYSTEM_ICON_ASSETS["file-manager"]);
  expect(markup).toContain(SHORTCUT_OVERLAY_ASSET);
  expect(markup).toContain('data-icon-context="taskbar"');
});
