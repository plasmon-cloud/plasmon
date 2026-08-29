import { expect, test } from "bun:test";
import type { ResourceClassification } from "../fs/resourcePolicy.ts";
import { FILE_TYPE_ICON_ASSETS, SHORTCUT_OVERLAY_ASSET, SYSTEM_ICON_ASSETS } from "./assets.ts";
import { composeShortcutPresentation, resolveImagePresentation } from "./presentation.ts";
import {
  resourcePresentationForClassification,
  nativeHandlerResourcePresentation,
} from "./resource-presentation.ts";

function classification(
  kind: ResourceClassification["kind"],
  contentKind: ResourceClassification["type"]["contentKind"] = "unknown",
): ResourceClassification {
  return {
    kind,
    ownership: "user",
    systemApp: null,
    neutronApp: null,
    type: {
      extension: "",
      mime: null,
      contentKind,
      language: null,
      source: "fallback",
    },
  };
}

test("shared presentation retains stable fallback and shortcut identity", () => {
  const target = { kind: "native", src: "/app/plasmon/apps/mail/static/icon.svg" } as const;
  expect(composeShortcutPresentation(target)).toEqual({ target, shortcut: true });
  expect(resolveImagePresentation(target.src, target.src)).toEqual({ kind: "fallback" });
  expect(resolveImagePresentation(null, null)).toEqual({ kind: "fallback" });
});

test("shared asset vocabulary is package-relative and includes canonical resource classes", () => {
  for (const path of [
    FILE_TYPE_ICON_ASSETS.folder,
    FILE_TYPE_ICON_ASSETS.file,
    SYSTEM_ICON_ASSETS["recycle-bin"],
    SHORTCUT_OVERLAY_ASSET,
  ]) expect(path.startsWith("/")).toBe(false);
  expect(FILE_TYPE_ICON_ASSETS.folder).toEndWith("static/plasmon/icons/folder.svg");
  expect(FILE_TYPE_ICON_ASSETS.file).toEndWith("static/plasmon/icons/file.svg");
  expect(SYSTEM_ICON_ASSETS["recycle-bin"]).toEndWith("static/plasmon/icons/recycle-bin.svg");
  expect(SHORTCUT_OVERLAY_ASSET).toEndWith("static/plasmon/icons/shortcut-overlay.svg");
});

test("one Visual resolver maps already-classified file and application identities", () => {
  expect(resourcePresentationForClassification(classification("directory"))).toEqual({
    kind: "file-type",
    icon: "folder",
  });
  expect(resourcePresentationForClassification(classification("ordinary-file", "audio"))).toEqual({
    kind: "file-type",
    icon: "audio",
  });

  const system = classification("system-app");
  system.systemApp = {
    format: "plasmon.system-app",
    version: 1,
    systemId: "explorer",
    handlerId: "native:explorer",
  };
  expect(resourcePresentationForClassification(system)).toEqual({ kind: "system", icon: "file-manager" });

  const neutron = classification("neutron-app");
  neutron.neutronApp = {
    format: "plasmon-neutron-app",
    version: 1,
    elementId: "mail",
    icon: "/app/mail/static/icon.svg",
  };
  expect(resourcePresentationForClassification(neutron)).toEqual({
    kind: "application",
    src: "/app/mail/static/icon.svg",
  });
});

test("known first-party native identity stays semantic while unknown native artwork stays authored", () => {
  expect(nativeHandlerResourcePresentation("native:explorer", "/apps/explorer/icon.svg")).toEqual({
    kind: "system",
    icon: "file-manager",
  });
  expect(nativeHandlerResourcePresentation("native:unknown", "/apps/example/icon.svg")).toEqual({
    kind: "application",
    src: "/apps/example/icon.svg",
  });
  expect(nativeHandlerResourcePresentation("native:unknown")).toEqual({
    kind: "application",
    src: null,
  });
});
