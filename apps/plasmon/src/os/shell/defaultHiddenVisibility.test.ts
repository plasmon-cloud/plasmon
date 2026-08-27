// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import { FileManagerPreferenceStore } from "../file-manager/preferences.ts";
import { createShortcut } from "../fs/shortcut.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { searchShellVisibleByDefault } from "./searchVisibility.ts";
import { listVisibleStartMenuFolder } from "./startVisibility.ts";

test("#466 Search applies canonical default hidden state to resources, native projections, and shortcut targets", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const root = await env.node("/");
    if (!root) throw new Error("Filesystem root is unavailable");

    const visibleFile = await env.services.fs.createFile(root.id, "visible-466.txt", { mime: "text/plain" });
    const hiddenFile = await env.services.fs.createFile(root.id, ".hidden-466.txt", { mime: "text/plain" });
    const hiddenDirectory = await env.services.fs.mkdir(root.id, ".hidden-folder-466");
    const visibleShortcut = await createShortcut(
      env.services.fs,
      root.id,
      { kind: "node", nodeId: visibleFile.id },
      { name: "Visible 466 target" },
    );
    const hiddenShortcut = await createShortcut(
      env.services.fs,
      root.id,
      { kind: "node", nodeId: hiddenFile.id },
      { name: "Hidden 466 target" },
    );

    const nativeApps = env.services.nativeApps.list();
    const properties = await searchShellVisibleByDefault(env.services.fs, nativeApps, [], "Properties");
    expect(properties.results.some((result) =>
      result.kind === "native-app" && result.app.handlerId === "native:properties"
    )).toBe(false);
    expect(properties.results.some((result) =>
      "node" in result && result.node.name === ".Properties.sys"
    )).toBe(false);

    const hidden = await searchShellVisibleByDefault(env.services.fs, nativeApps, [], "hidden-466");
    expect(hidden.results.some((result) => "node" in result && result.node.id === hiddenFile.id)).toBe(false);
    expect(hidden.results.some((result) => "node" in result && result.node.id === hiddenDirectory.id)).toBe(false);

    const hiddenShortcutResults = await searchShellVisibleByDefault(
      env.services.fs,
      nativeApps,
      [],
      "Hidden 466 target",
    );
    expect(hiddenShortcutResults.results.some((result) =>
      result.kind === "start-shortcut" && result.node.id === hiddenShortcut.id
    )).toBe(false);

    const visibleShortcutResults = await searchShellVisibleByDefault(
      env.services.fs,
      nativeApps,
      [],
      "Visible 466 target",
    );
    expect(visibleShortcutResults.results.some((result) =>
      result.kind === "start-shortcut" && result.node.id === visibleShortcut.id
    )).toBe(true);
  } finally {
    env.dispose();
  }
});

test("#429 global hidden visibility widens Search without regressing #466 projection filtering", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const root = await env.node("/");
    if (!root) throw new Error("Filesystem root is unavailable");

    const hiddenFile = await env.services.fs.createFile(root.id, ".global-hidden-429.txt", { mime: "text/plain" });
    const hiddenShortcut = await createShortcut(
      env.services.fs,
      root.id,
      { kind: "node", nodeId: hiddenFile.id },
      { name: "Global Hidden 429 target" },
    );

    await env.services.hiddenVisibility.setAlwaysShowHiddenFiles(true);
    const nativeApps = env.services.nativeApps.list();

    const properties = await searchShellVisibleByDefault(env.services.fs, nativeApps, [], "Properties");
    expect(properties.results.some((result) =>
      result.kind === "native-app" && result.app.handlerId === "native:properties"
    )).toBe(true);

    const hidden = await searchShellVisibleByDefault(env.services.fs, nativeApps, [], "global-hidden-429");
    expect(hidden.results.some((result) => "node" in result && result.node.id === hiddenFile.id)).toBe(true);

    const shortcut = await searchShellVisibleByDefault(
      env.services.fs,
      nativeApps,
      [],
      "Global Hidden 429 target",
    );
    expect(shortcut.results.some((result) =>
      result.kind === "start-shortcut" && result.node.id === hiddenShortcut.id
    )).toBe(true);
  } finally {
    env.dispose();
  }
});

test("#466 Start hides canonical hidden targets without deleting or rewriting shortcuts", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const root = await env.node("/");
    const start = await env.node("/System/Start Menu");
    if (!root || !start) throw new Error("Start fixture roots are unavailable");

    const visibleTarget = await env.services.fs.createFile(root.id, "visible-start-466.txt", { mime: "text/plain" });
    const hiddenTarget = await env.services.fs.createFile(root.id, ".hidden-start-466.txt", { mime: "text/plain" });
    const visibleShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "node", nodeId: visibleTarget.id },
      { name: "Visible Start 466" },
    );
    const hiddenShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "node", nodeId: hiddenTarget.id },
      { name: "Hidden Start 466" },
    );
    const propertiesShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "native", handlerId: "native:properties" },
      { name: "Properties Start 466" },
    );

    const visible = await listVisibleStartMenuFolder(env.services.fs, start.id);
    expect(visible.some((node) => node.id === visibleShortcut.id)).toBe(true);
    expect(visible.some((node) => node.id === hiddenShortcut.id)).toBe(false);
    expect(visible.some((node) => node.id === propertiesShortcut.id)).toBe(false);

    const preserved = await env.services.fs.stat(hiddenShortcut.id);
    expect(preserved.id).toBe(hiddenShortcut.id);
    expect(preserved.metadata).toEqual(hiddenShortcut.metadata);
    expect((await env.services.fs.stat(propertiesShortcut.id)).id).toBe(propertiesShortcut.id);
  } finally {
    env.dispose();
  }
});

test("#466 Explorer-local Show hidden files does not change Search or Start default visibility", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const preferences = new FileManagerPreferenceStore(env.services.fs);
    await preferences.save({ version: 1, showHiddenFiles: true });
    expect((await preferences.load()).showHiddenFiles).toBe(true);

    const search = await searchShellVisibleByDefault(
      env.services.fs,
      env.services.nativeApps.list(),
      [],
      "Properties",
    );
    expect(search.results.some((result) =>
      result.kind === "native-app" && result.app.handlerId === "native:properties"
    )).toBe(false);

    const start = await env.node("/System/Start Menu");
    if (!start) throw new Error("Start root is unavailable");
    const propertiesShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "native", handlerId: "native:properties" },
      { name: "Local preference must not expose Properties" },
    );
    const visible = await listVisibleStartMenuFolder(env.services.fs, start.id);
    expect(visible.some((node) => node.id === propertiesShortcut.id)).toBe(false);
  } finally {
    env.dispose();
  }
});
