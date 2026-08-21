// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { createShortcut } from "../fs/shortcut.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { searchShell } from "./search.ts";
import { listVisibleStartMenuFolder } from "./startVisibility.ts";

test("Search excludes hidden files, directories, and Properties projection by default and includes them globally without duplicates", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const root = await env.node("/");
    if (!root) throw new Error("Filesystem root is unavailable");
    const hiddenFile = await env.services.fs.createFile(root.id, ".search-secret.txt", { mime: "text/plain" });
    const hiddenDirectory = await env.services.fs.mkdir(root.id, ".search-secret-folder");
    const hiddenShortcut = await createShortcut(
      env.services.fs,
      root.id,
      { kind: "node", nodeId: hiddenFile.id },
      { name: "Hidden target shortcut" },
    );

    const nativeApps = env.services.nativeApps.list();
    const offProperties = await searchShell(env.services.fs, nativeApps, [], "Properties");
    expect(offProperties.results.some((result) =>
      result.kind === "native-app" && result.app.handlerId === "native:properties"
    )).toBe(false);
    expect(offProperties.results.some((result) =>
      result.kind === "file" && result.node.name === ".Properties.sys"
    )).toBe(false);

    const offSecrets = await searchShell(env.services.fs, nativeApps, [], "search-secret");
    expect(offSecrets.results.some((result) => "node" in result && result.node.id === hiddenFile.id)).toBe(false);
    expect(offSecrets.results.some((result) => "node" in result && result.node.id === hiddenDirectory.id)).toBe(false);
    const offShortcut = await searchShell(env.services.fs, nativeApps, [], "Hidden target shortcut");
    expect(offShortcut.results.some((result) => result.kind === "start-shortcut" && result.node.id === hiddenShortcut.id)).toBe(false);

    await env.services.hiddenVisibility.setAlwaysShowHiddenFiles(true);

    const onProperties = await searchShell(env.services.fs, nativeApps, [], "Properties");
    const propertiesResults = onProperties.results.filter((result) =>
      (result.kind === "native-app" && result.app.handlerId === "native:properties")
      || (result.kind === "file" && result.node.name === ".Properties.sys")
    );
    expect(propertiesResults).toHaveLength(1);

    const onSecrets = await searchShell(env.services.fs, nativeApps, [], "search-secret");
    expect(onSecrets.results.some((result) => "node" in result && result.node.id === hiddenFile.id)).toBe(true);
    expect(onSecrets.results.some((result) => "node" in result && result.node.id === hiddenDirectory.id)).toBe(true);
    const onShortcut = await searchShell(env.services.fs, nativeApps, [], "Hidden target shortcut");
    expect(onShortcut.results.some((result) => result.kind === "start-shortcut" && result.node.id === hiddenShortcut.id)).toBe(true);
  } finally {
    env.dispose();
  }
});

test("Start filters hidden shortcut targets without deleting shortcut authority and restores them when global visibility is on", async () => {
  const env = createHeadlessPlasmonEnvironment();
  await env.ready;
  try {
    const root = await env.node("/");
    const start = await env.node("/System/Start Menu");
    if (!root || !start) throw new Error("Start fixture roots are unavailable");

    const visibleTarget = await env.services.fs.createFile(root.id, "visible-start-target.txt", { mime: "text/plain" });
    const hiddenTarget = await env.services.fs.createFile(root.id, ".hidden-start-target.txt", { mime: "text/plain" });
    const visibleShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "node", nodeId: visibleTarget.id },
      { name: "Visible target" },
    );
    const hiddenShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "node", nodeId: hiddenTarget.id },
      { name: "Hidden target" },
    );
    const propertiesShortcut = await createShortcut(
      env.services.fs,
      start.id,
      { kind: "native", handlerId: "native:properties" },
      { name: "Hidden Properties target" },
    );

    const off = await listVisibleStartMenuFolder(env.services.fs, start.id);
    expect(off.some((node) => node.id === visibleShortcut.id)).toBe(true);
    expect(off.some((node) => node.id === hiddenShortcut.id)).toBe(false);
    expect(off.some((node) => node.id === propertiesShortcut.id)).toBe(false);
    expect((await env.services.fs.stat(hiddenShortcut.id)).id).toBe(hiddenShortcut.id);
    expect((await env.services.fs.stat(propertiesShortcut.id)).id).toBe(propertiesShortcut.id);

    await env.services.hiddenVisibility.setAlwaysShowHiddenFiles(true);
    const on = await listVisibleStartMenuFolder(env.services.fs, start.id);
    expect(on.some((node) => node.id === visibleShortcut.id)).toBe(true);
    expect(on.some((node) => node.id === hiddenShortcut.id)).toBe(true);
    expect(on.some((node) => node.id === propertiesShortcut.id)).toBe(true);

    await env.services.hiddenVisibility.setAlwaysShowHiddenFiles(false);
    const offAgain = await listVisibleStartMenuFolder(env.services.fs, start.id);
    expect(offAgain.some((node) => node.id === hiddenShortcut.id)).toBe(false);
    expect((await env.services.fs.stat(hiddenShortcut.id)).id).toBe(hiddenShortcut.id);
  } finally {
    env.dispose();
  }
});
