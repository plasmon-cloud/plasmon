import { expect, test } from "bun:test";
import type { FsService } from "../../os/contracts/index.ts";
import { createSettingsComponent } from "./Settings.tsx";
import {
  createSettingsOpenTarget,
  DEFAULT_SETTINGS_DESTINATION,
  formatBytes,
  normalizeSettingsDestination,
  SETTINGS_DESTINATION_IDS,
  SETTINGS_SECTIONS,
  settingsDestinationFromTarget,
  summarizeStorage,
  withSettingsDestination,
} from "./model.ts";

const fs = {
  resolvePath: async () => ({ id: "root", parentId: null, name: "", kind: "directory", size: 0, createdAt: 0, modifiedAt: 0, metadata: {} }),
  stat: async (id: string) => ({ id, parentId: null, name: "", kind: "directory", size: 0, createdAt: 0, modifiedAt: 0, metadata: {} }),
  list: async (id: string) => id === "root"
    ? [
      { id: "a", parentId: "root", name: "a.txt", kind: "file", size: 100, createdAt: 0, modifiedAt: 0, metadata: {} },
      { id: "dir", parentId: "root", name: "dir", kind: "directory", size: 0, createdAt: 0, modifiedAt: 0, metadata: {} },
    ]
    : [{ id: "b", parentId: "dir", name: "b.bin", kind: "file", size: 2048, createdAt: 0, modifiedAt: 0, metadata: {} }],
} as unknown as FsService;

test("Settings destinations are stable and map only to current real hub sections", () => {
  expect(SETTINGS_DESTINATION_IDS).toEqual([
    "home",
    "personalization",
    "taskbar",
    "files",
    "storage",
    "diagnostics",
  ]);
  expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual(SETTINGS_DESTINATION_IDS);
  expect(SETTINGS_SECTIONS.map((section) => section.label)).toEqual([
    "Home",
    "Personalization",
    "Taskbar",
    "Files & Explorer",
    "Storage",
    "Diagnostics",
  ]);
  expect(SETTINGS_SECTIONS.some((section) => /backup|sharing|association/i.test(section.id))).toBe(false);
});

test("Settings destination normalization falls back safely to home", () => {
  expect(DEFAULT_SETTINGS_DESTINATION).toBe("home");
  expect(normalizeSettingsDestination("personalization")).toBe("personalization");
  expect(normalizeSettingsDestination("taskbar")).toBe("taskbar");
  expect(normalizeSettingsDestination("stale-destination")).toBe("home");
  expect(normalizeSettingsDestination(undefined)).toBe("home");
  expect(settingsDestinationFromTarget({ url: "plasmon-settings:diagnostics" })).toBe("diagnostics");
  expect(settingsDestinationFromTarget({ url: "plasmon-settings:removed-page" })).toBe("home");
  expect(settingsDestinationFromTarget({ url: "https://example.invalid/not-settings" })).toBe("home");
});

test("Settings targets carry navigation state without discarding activation context", () => {
  expect(createSettingsOpenTarget()).toEqual({ url: "plasmon-settings:home" });
  expect(createSettingsOpenTarget("personalization")).toEqual({ url: "plasmon-settings:personalization" });
  expect(withSettingsDestination({ nodeId: "settings-node", readOnly: true }, "storage")).toEqual({
    nodeId: "settings-node",
    readOnly: true,
    url: "plasmon-settings:storage",
  });
});

test("storage summary walks the existing filesystem without a new backend", async () => {
  expect(await summarizeStorage(fs)).toEqual({ files: 2, directories: 2, bytes: 2148 });
  expect(formatBytes(2048)).toBe("2.00 KB");
});

test("Settings callback seam requires no Shell implementation import", () => {
  const changes: string[] = [];
  const Component = createSettingsComponent({ setThemeName: (value) => changes.push(value) });
  expect(typeof Component).toBe("function");
  expect(changes).toEqual([]);
});
