import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "bun:test";
import { classifyRuntimeCostPath, measureRuntimeCosts } from "../runtimeCostReport.ts";

async function withTempDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "plasmon-runtime-cost-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function put(root: string, path: string, contents: string | Uint8Array): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
}

describe("runtime cost report", () => {
  test("classifies package contributors by durable runtime/product category", () => {
    expect(classifyRuntimeCostPath("web/System/Program Files/MonacoEditor/ts.worker.js")).toBe("monaco");
    expect(classifyRuntimeCostPath("web/runtime/jsdos/js-dos.js")).toBe("js-dos");
    expect(classifyRuntimeCostPath("web/System/Program Files/EmulatorJS/data/loader.js")).toBe("emulatorjs");
    expect(classifyRuntimeCostPath("web/Games/Plasmon Demo.jsdos")).toBe("game-content");
    expect(classifyRuntimeCostPath("web/static/plasmon/artwork/demo.svg")).toBe("artwork-media");
    expect(classifyRuntimeCostPath("mo/abc.mo")).toBe("package-metadata");
    expect(classifyRuntimeCostPath("web/main.js")).toBe("core-plasmon");
  });

  test("reports exact raw totals, archive bytes, categories, and duplicate physical runtime copies", async () => {
    await withTempDirectory(async (directory) => {
      const dist = join(directory, "dist");
      const duplicate = new TextEncoder().encode("same runtime bytes");
      await put(dist, "web/System/Program Files/js-dos/js-dos.js", duplicate);
      await put(dist, "web/runtime/jsdos/js-dos.js", duplicate);
      await put(dist, "web/System/Program Files/MonacoEditor/editor.worker.js", "worker");
      await put(dist, "web/Games/Test.nes", "game");
      await put(dist, "web/main.js", "main");
      await put(dist, "neutron.json", "manifest");
      const archive = join(directory, "plasmon.v0.1.0.neutron");
      await writeFile(archive, "archive-bytes");

      const report = await measureRuntimeCosts(dist, { archivePath: archive });
      expect(report.totals.files).toBe(6);
      expect(report.archive?.bytes).toBe("archive-bytes".length);
      expect(report.categories.find((entry) => entry.category === "js-dos")).toEqual({
        category: "js-dos",
        files: 2,
        bytes: duplicate.byteLength * 2,
      });
      expect(report.duplicateGroups).toHaveLength(1);
      expect(report.duplicateGroups[0]).toMatchObject({
        bytesPerCopy: duplicate.byteLength,
        copies: 2,
        duplicateBytes: duplicate.byteLength,
      });
      expect(report.duplicateGroups[0].paths).toEqual([
        "web/System/Program Files/js-dos/js-dos.js",
        "web/runtime/jsdos/js-dos.js",
      ]);
      expect(report.totals.duplicateBytes).toBe(duplicate.byteLength);
    });
  });
});
