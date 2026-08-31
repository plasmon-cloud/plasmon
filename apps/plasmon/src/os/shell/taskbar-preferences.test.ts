// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type {
  CreateFileOptions,
  FsEvent,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  JsonValue,
  NodeId,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import {
  DEFAULT_SHELL_PREFERENCES,
  SHELL_PREFERENCES_KEY,
  SHELL_TASKBAR_ALIGNMENTS,
  SHELL_TASKBAR_ICON_SIZES,
  SHELL_TASKBAR_PLACEMENTS,
  ShellPreferenceStore,
  validateShellPreferences,
  type ShellPreferences,
} from "./preferences.ts";
import { deriveShellTaskbarLayout, TASKBAR_ICON_PIXELS } from "./taskbar-layout.ts";
import { placeTaskbarContextMenu } from "./taskbar.ts";

class PreferenceFs implements FsService {
  readonly root: FsNode = {
    id: "root",
    parentId: null,
    name: "",
    kind: "directory",
    size: 0,
    createdAt: 0,
    modifiedAt: 0,
    metadata: {},
  };

  async stat(id: NodeId): Promise<FsNode> {
    if (id !== this.root.id) throw new Error(`missing node ${id}`);
    return this.snapshot();
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    return path === "/" ? this.snapshot() : null;
  }

  async pathOf(id: NodeId): Promise<string> {
    if (id !== this.root.id) throw new Error(`missing node ${id}`);
    return "/";
  }

  async list(_parentId: NodeId, _options?: FsListOptions): Promise<FsNode[]> { return []; }
  async mkdir(): Promise<FsNode> { throw new Error("unused"); }
  async createFile(_parentId: NodeId, _name: string, _options?: CreateFileOptions): Promise<FsNode> { throw new Error("unused"); }
  async read(_id: NodeId, _range?: FsReadRange): Promise<Uint8Array> { throw new Error("unused"); }
  async write(_id: NodeId, _bytes: Uint8Array, _options?: WriteOptions): Promise<FsNode> { throw new Error("unused"); }
  async rename(): Promise<FsNode> { throw new Error("unused"); }
  async move(): Promise<FsNode> { throw new Error("unused"); }
  async copy(): Promise<FsNode> { throw new Error("unused"); }
  async remove(): Promise<void> { throw new Error("unused"); }

  async setMetadata(id: NodeId, patch: Record<string, JsonValue | null>): Promise<FsNode> {
    if (id !== this.root.id) throw new Error(`missing node ${id}`);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete this.root.metadata[key];
      else this.root.metadata[key] = value;
    }
    return this.snapshot();
  }

  async revision(): Promise<Revision> { return 0n; }
  subscribe(_listener: (event: FsEvent) => void): () => void { return () => undefined; }

  private snapshot(): FsNode {
    return { ...this.root, metadata: structuredClone(this.root.metadata) };
  }
}

function preferences(patch: Partial<ShellPreferences> = {}): ShellPreferences {
  return {
    ...DEFAULT_SHELL_PREFERENCES,
    pinnedNative: [...DEFAULT_SHELL_PREFERENCES.pinnedNative],
    pinnedElements: [...DEFAULT_SHELL_PREFERENCES.pinnedElements],
    wallpaper: DEFAULT_SHELL_PREFERENCES.wallpaper.mode === "pinned"
      ? { ...DEFAULT_SHELL_PREFERENCES.wallpaper }
      : { mode: "follow-theme" },
    ...patch,
  };
}

test("taskbar preference contract has bounded deterministic defaults", () => {
  expect(SHELL_TASKBAR_ALIGNMENTS).toEqual(["center", "left"]);
  expect(SHELL_TASKBAR_PLACEMENTS).toEqual(["bottom", "top"]);
  expect(SHELL_TASKBAR_ICON_SIZES).toEqual(["small", "medium", "large"]);
  expect(DEFAULT_SHELL_PREFERENCES.taskbarAlignment).toBe("center");
  expect(DEFAULT_SHELL_PREFERENCES.taskbarPlacement).toBe("bottom");
  expect(DEFAULT_SHELL_PREFERENCES.taskbarIconSize).toBe("medium");
  expect(DEFAULT_SHELL_PREFERENCES.showNeutronTray).toBe(true);
});

test("legacy v1 preference objects gain taskbar defaults without losing existing values", () => {
  expect(validateShellPreferences({
    version: 1,
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-midnight",
    wallpaper: { mode: "follow-theme" },
    showBrandWatermark: false,
    taskbarAlignment: "left",
  })).toEqual(preferences({
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    themeId: "plasmon-midnight",
    showBrandWatermark: false,
    taskbarAlignment: "left",
  }));
});

test("explicit unsupported taskbar values fail validation instead of being strengthened", () => {
  const valid = preferences();
  expect(validateShellPreferences({ ...valid, taskbarPlacement: "right" })).toBeNull();
  expect(validateShellPreferences({ ...valid, taskbarIconSize: "extra-large" })).toBeNull();
  expect(validateShellPreferences({ ...valid, showNeutronTray: "yes" })).toBeNull();
});

test("taskbar fields persist through the existing filesystem-backed Shell preference store", async () => {
  const fs = new PreferenceFs();
  const selected = preferences({
    pinnedNative: ["native:text"],
    pinnedElements: ["mail"],
    taskbarAlignment: "left",
    taskbarPlacement: "top",
    taskbarIconSize: "large",
    showNeutronTray: false,
  });

  await new ShellPreferenceStore(fs).save(selected);
  expect(await new ShellPreferenceStore(fs).load()).toEqual(selected);
  expect(fs.root.metadata[SHELL_PREFERENCES_KEY]).toEqual(selected);
});

test("taskbar layout derivation maps placement size and tray visibility without window geometry", () => {
  const bottom = deriveShellTaskbarLayout(preferences());
  expect(bottom).toEqual({
    placement: "bottom",
    workspaceInsetTop: false,
    workspaceInsetBottom: true,
    flyoutEdge: "bottom",
    taskIconSize: "medium",
    taskIconPixels: TASKBAR_ICON_PIXELS.medium,
    showNeutronTray: true,
  });

  const top = deriveShellTaskbarLayout(preferences({
    taskbarPlacement: "top",
    taskbarIconSize: "small",
    showNeutronTray: false,
  }));
  expect(top).toEqual({
    placement: "top",
    workspaceInsetTop: true,
    workspaceInsetBottom: false,
    flyoutEdge: "top",
    taskIconSize: "small",
    taskIconPixels: TASKBAR_ICON_PIXELS.small,
    showNeutronTray: false,
  });
  expect(TASKBAR_ICON_PIXELS.large).toBeGreaterThan(TASKBAR_ICON_PIXELS.medium);
  expect(TASKBAR_ICON_PIXELS.medium).toBeGreaterThan(TASKBAR_ICON_PIXELS.small);
});

test("Top placement insets workspace and anchors Shell-owned flyouts below the taskbar", () => {
  const css = readFileSync(new URL("./taskbar-behavior.scss", import.meta.url), "utf8");
  expect(css).toContain('.plasmon-shell[data-taskbar-placement="top"] .plasmon-shell__workspace');
  expect(css).toContain("bottom: 0;");
  expect(css).toContain("top: var(--plasmon-taskbar-height);");
  expect(css).toContain('.plasmon-shell[data-taskbar-placement="top"] .plasmon-shell__taskbar');
  expect(css).toContain('.plasmon-shell[data-taskbar-placement="top"] .plasmon-shell__panel:not(.plasmon-shell__context-menu)');
  expect(css).toContain("top: calc(var(--plasmon-taskbar-height) + 10px);");
  expect(css).not.toContain('data-taskbar-placement="left"');
  expect(css).not.toContain('data-taskbar-placement="right"');
});

test("taskbar context menus stay source-adjacent at either horizontal taskbar edge", () => {
  const viewport = { width: 1200, height: 800 };
  const menu = { width: 230, height: 160 };
  const fromTop = placeTaskbarContextMenu(
    { left: 420, top: 0, width: 48, height: 54 },
    viewport,
    menu,
  );
  const fromBottom = placeTaskbarContextMenu(
    { left: 420, top: 746, width: 48, height: 54 },
    viewport,
    menu,
  );
  expect(fromTop.y).toBeGreaterThan(54);
  expect(fromBottom.y + menu.height).toBeLessThan(746);
});

test("task icon sizing keeps medium at current scale and tray hiding is presentation-only CSS", () => {
  const css = readFileSync(new URL("./taskbar-behavior.scss", import.meta.url), "utf8");
  expect(css).toContain('--plasmon-shell-task-icon-size: 26px;');
  expect(css).toContain('--plasmon-shell-task-icon-size: 34px;');
  expect(css).toContain('--plasmon-shell-task-icon-size: 40px;');
  expect(css).toContain('.plasmon-shell .plasmon-shell__taskbar .plasmon-shell__app-icon');
  expect(css).toContain('.plasmon-shell[data-neutron-tray-visible="false"] .plasmon-shell__tray-button');
  expect(css).toContain("display: none;");
});
