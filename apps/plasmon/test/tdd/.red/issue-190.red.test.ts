import { expect, test } from "bun:test";
import { FILE_TYPE_ICON_ASSETS, SHORTCUT_OVERLAY_ASSET, SYSTEM_ICON_ASSETS } from "../../../src/os/visual/assets.ts";
import { composeShortcutPresentation, resolveImagePresentation } from "../../../src/os/visual/presentation.ts";

test("#190 characterization — shared presentation retains stable fallback and shortcut identity", () => {
  const target = { kind: "native", src: "/app/plasmon/apps/mail/static/icon.svg" } as const;
  expect(composeShortcutPresentation(target)).toEqual({ target, shortcut: true });
  expect(resolveImagePresentation(target.src, target.src)).toEqual({ kind: "fallback" });
  expect(resolveImagePresentation(null, null)).toEqual({ kind: "fallback" });
});

test("#190 characterization — shared asset vocabulary includes canonical resource classes", () => {
  expect(FILE_TYPE_ICON_ASSETS.folder).toContain("/static/plasmon/icons/folder.svg");
  expect(FILE_TYPE_ICON_ASSETS.file).toContain("/static/plasmon/icons/file.svg");
  expect(SYSTEM_ICON_ASSETS["recycle-bin"]).toContain("/static/plasmon/icons/recycle-bin.svg");
  expect(SHORTCUT_OVERLAY_ASSET).toContain("/static/plasmon/icons/shortcut-overlay.svg");
});
