import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  modeFromTools,
  normalizePackageUrl,
  parseAppDescription,
  parseInstalledAppIds,
  parseLiveAppIds,
  toolNames,
} from "../src/platform/parse.ts";

test("freezes the Plasmon package contract at manifest 100 / npm 0.1.0", async () => {
  const [manifest, workspace, deployment] = await Promise.all([
    readFile(new URL("../neutron.json", import.meta.url), "utf8").then((value) => JSON.parse(value) as { version?: number }),
    readFile(new URL("../package.json", import.meta.url), "utf8").then((value) => JSON.parse(value) as { version?: string }),
    readFile(new URL("../../../plasmon-local.ndeploy.json", import.meta.url), "utf8").then((value) => JSON.parse(value) as {
      artifacts?: { packages?: Array<{ path?: string }> };
    }),
  ]);

  expect(workspace.version).toBe("0.1.0");
  expect(manifest.version).toBe(100);
  expect(deployment.artifacts?.packages?.map(({ path }) => path)).toContain(
    "apps/plasmon/plasmon.v0.1.0.neutron",
  );
});

test("parses vanilla Neutron installed app discovery", () => {
  expect(
    parseInstalledAppIds({
      apps: [
        { id: "files", description: "File manager" },
        { id: "chess", description: "Chess" },
      ],
    }),
  ).toEqual([
    { id: "files", description: "File manager" },
    { id: "chess", description: "Chess" },
  ]);
});

test("parses safe apps.describe metadata including tray declaration", () => {
  expect(
    parseAppDescription(
      {
        id: "files",
        name: "Files",
        version: 403,
        tiles: [
          { id: "main", title: "Files", description: "Browse files" },
        ],
        tray: { title: "Files activity" },
      },
      "fallback",
    ),
  ).toEqual({
    id: "files",
    name: "Files",
    description: "fallback",
    version: 403,
    tiles: [
      { id: "main", title: "Files", description: "Browse files" },
    ],
    tray: { title: "Files activity" },
  });
});

test("extracts only live app tile endpoints for taskbar state", () => {
  expect(
    [...parseLiveAppIds({
      endpoints: [
        { endpoint: "kernel", role: "kernel", connected: true },
        { endpoint: "app:mail:background", role: "background", appId: "mail" },
        { endpoint: "app:chess:tile:board:instance:1", role: "tile", appId: "chess" },
        { endpoint: "app:plasmon:tile:main:instance:2", role: "tile", appId: "plasmon" },
      ],
    })],
  ).toEqual(["chess"]);
});

test("detects tenant extensions by capabilities rather than product name", () => {
  const vanilla = toolNames([
    { name: "apps.list" },
    { name: "apps.describe" },
    { name: "workspace.open_tile" },
  ]);
  expect(modeFromTools(vanilla)).toBe("neutron");

  const extended = new Set([...vanilla, "apps.catalog", "apps.allocate"]);
  expect(modeFromTools(extended)).toBe("tenant-capable");
});

test("normalizes HTTP(S) Neutron package URLs", () => {
  expect(normalizePackageUrl(" https://example.com/files.v0.1.0.neutron ")).toBe(
    "https://example.com/files.v0.1.0.neutron",
  );
  expect(normalizePackageUrl("http://localhost:8080/chess.neutron")).toBe(
    "http://localhost:8080/chess.neutron",
  );
  expect(() => normalizePackageUrl("javascript:app.neutron")).toThrow(
    "HTTP or HTTPS",
  );
  expect(() => normalizePackageUrl("https://example.com/app.zip")).toThrow(
    ".neutron",
  );
});

test("rejects malformed discovery payloads", () => {
  expect(() => parseInstalledAppIds({ apps: [{ id: "files" }] })).toThrow();
  expect(() =>
    parseAppDescription({ id: "files", name: "Files" }, "fallback"),
  ).toThrow();
});
