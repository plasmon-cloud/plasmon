import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { packDirectory } from "../src/pack.ts";

test("packer rejects symlinked package inputs without writing an archive", async () => {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "neutron-pack-unreadable-"),
  );
  const archivePath = path.join(rootDir, "broken.v0.1.0.neutron");

  try {
    await fs.writeFile(
      path.join(rootDir, "neutron.json"),
      JSON.stringify({ id: "broken", version: 100 }),
    );
    await fs.mkdir(path.join(rootDir, "dist"));
    await fs.writeFile(path.join(rootDir, "outside.html"), "not package data");
    await fs.symlink(
      path.join(rootDir, "outside.html"),
      path.join(rootDir, "dist", "index.html"),
    );

    await expect(packDirectory(rootDir)).rejects.toThrow(
      "Package input must not be a symbolic link",
    );
    await expect(fs.stat(archivePath)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test("packer rejects documentation and source-only artifacts before writing an archive", async () => {
  const rejectedPaths = [
    "README.md",
    "web/main.js.map",
    "src/app.ts",
    "tests/app.test.js",
  ] as const;

  for (const rejectedPath of rejectedPaths) {
    const rootDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "neutron-pack-non-runtime-"),
    );
    const archivePath = path.join(rootDir, "clean.v0.1.0.neutron");

    try {
      await fs.writeFile(
        path.join(rootDir, "neutron.json"),
        JSON.stringify({ id: "clean", version: 100 }),
      );
      const absolutePath = path.join(rootDir, "dist", rejectedPath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, "repository-only bytes");

      await expect(packDirectory(rootDir)).rejects.toThrow(
        `Non-runtime package input is forbidden: ${rejectedPath}`,
      );
      await expect(fs.stat(archivePath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  }
});
