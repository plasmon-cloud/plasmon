// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";
import { effectiveShellWallpaper } from "../src/os/shell/preferences.ts";
import { resolveFilesystemWallpaper } from "../src/os/shell/wallpaperResource.ts";

const SVG_ONE = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#123456"/></svg>';
const SVG_TWO = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#abcdef"/></svg>';

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

test("filesystem wallpaper NodeId survives rename/move, re-reads bytes, falls back, restores, and recomposes", async () => {
  const env = createHeadlessPlasmonEnvironment();
  const repository = env.repository;
  try {
    await env.ready;
    await env.os.fs.createDirectory("/Wallpaper Source");
    await env.os.fs.createDirectory("/Wallpaper Moved");
    const created = await env.os.fs.writeText("/Wallpaper Source/selected.svg", SVG_ONE);
    const targetId = created.id;

    const loaded = await env.services.shellPreferences.load();
    const save = await env.services.shellPreferences.save({
      ...loaded,
      themeId: "plasmon-glacier",
      appearanceMode: "light",
      wallpaper: { mode: "filesystem", nodeId: targetId },
      wallpaperLayout: "fit",
    });
    expect(save.saved).toBe(true);

    let resolved = await resolveFilesystemWallpaper(env.services.fs, targetId);
    expect(resolved?.nodeId).toBe(targetId);
    expect(text(resolved?.bytes ?? new Uint8Array())).toBe(SVG_ONE);

    await env.services.fs.rename(targetId, "renamed.svg");
    expect((await env.services.fs.stat(targetId)).id).toBe(targetId);
    expect(await env.services.fs.pathOf(targetId)).toBe("/Wallpaper Source/renamed.svg");
    resolved = await resolveFilesystemWallpaper(env.services.fs, targetId);
    expect(resolved?.name).toBe("renamed.svg");

    const destination = await env.services.fs.resolvePath("/Wallpaper Moved");
    if (!destination) throw new Error("Wallpaper destination directory is unavailable");
    await env.services.fs.move(targetId, destination.id);
    expect((await env.services.fs.stat(targetId)).id).toBe(targetId);
    expect(await env.services.fs.pathOf(targetId)).toBe("/Wallpaper Moved/renamed.svg");

    await env.services.fs.write(targetId, new TextEncoder().encode(SVG_TWO), { truncate: true });
    resolved = await resolveFilesystemWallpaper(env.services.fs, targetId);
    expect(text(resolved?.bytes ?? new Uint8Array())).toBe(SVG_TWO);

    await env.services.fs.rename(targetId, "temporarily-unsupported.txt");
    expect(await resolveFilesystemWallpaper(env.services.fs, targetId)).toBeNull();
    const snapshotWhileUnavailable = env.services.shellPreferences.getSnapshot();
    expect(snapshotWhileUnavailable.wallpaper).toEqual({ mode: "filesystem", nodeId: targetId });
    expect(effectiveShellWallpaper(snapshotWhileUnavailable.themeId, snapshotWhileUnavailable.wallpaper))
      .toBe("glacier-prism");

    await env.services.fs.rename(targetId, "restored.svg");
    resolved = await resolveFilesystemWallpaper(env.services.fs, targetId);
    expect(resolved?.nodeId).toBe(targetId);
    expect(text(resolved?.bytes ?? new Uint8Array())).toBe(SVG_TWO);

    await env.services.fs.remove(targetId);
    expect(await resolveFilesystemWallpaper(env.services.fs, targetId)).toBeNull();
    expect(env.services.shellPreferences.getSnapshot().wallpaper)
      .toEqual({ mode: "filesystem", nodeId: targetId });
  } finally {
    env.dispose();
  }

  const recomposed = createHeadlessPlasmonEnvironment({ repository });
  try {
    await recomposed.ready;
    const persisted = await recomposed.services.shellPreferences.load();
    expect(persisted.wallpaper).toEqual({ mode: "filesystem", nodeId: expect.any(String) });
    expect(persisted.wallpaperLayout).toBe("fit");
    expect(persisted.themeId).toBe("plasmon-glacier");
    expect(persisted.appearanceMode).toBe("light");
    expect(effectiveShellWallpaper(persisted.themeId, persisted.wallpaper)).toBe("glacier-prism");
    if (persisted.wallpaper.mode !== "filesystem") throw new Error("Filesystem target was not preserved");
    expect(await resolveFilesystemWallpaper(recomposed.services.fs, persisted.wallpaper.nodeId)).toBeNull();
  } finally {
    recomposed.dispose();
  }
});
