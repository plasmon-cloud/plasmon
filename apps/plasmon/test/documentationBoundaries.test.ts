import { expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type AgentsRule =
  | { mode: "local" }
  | { mode: "inherited"; from: string };

type Boundary = {
  path: string;
  kind: string;
  readme: "local";
  agents: AgentsRule;
};

type DiscoveryRoot = {
  path: string;
  children: "directories";
  nonBoundaryChildren: string[];
};

type BoundaryRegistry = {
  schema: string;
  root: string;
  discoveryRoots: DiscoveryRoot[];
  boundaries: Boundary[];
};

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(appRoot, "../..");
const registryPath = resolve(appRoot, "docs/documentation-boundaries.json");

const requiredCurrentDocuments = [
  "apps/plasmon/README.md",
  "apps/plasmon/AGENTS.md",
  "apps/plasmon/TESTING.md",
  "apps/plasmon/docs/README.md",
  "apps/plasmon/docs/GLOSSARY.md",
  "apps/plasmon/docs/FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md",
  "apps/plasmon/docs/atoms/README.md",
  "apps/plasmon/test/README.md",
  "apps/plasmon/test/AGENTS.md",
] as const;

function loadRegistry(): BoundaryRegistry {
  return JSON.parse(readFileSync(registryPath, "utf8")) as BoundaryRegistry;
}

function absoluteRepoPath(path: string): string {
  return resolve(repoRoot, path);
}

function childDirectories(path: string): string[] {
  return readdirSync(absoluteRepoPath(path), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function findAgentBoundaries(directory: string): string[] {
  const absolute = absoluteRepoPath(directory);
  const found: string[] = [];

  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = `${directory}/${entry.name}`;
    if (existsSync(resolve(absoluteRepoPath(child), "AGENTS.md"))) found.push(child);
    found.push(...findAgentBoundaries(child));
  }

  return found;
}

test("documentation boundary registry is parseable, unique, and resolves declared ownership", () => {
  const registry = loadRegistry();
  expect(registry.schema).toBe("plasmon-documentation-boundaries-v1");
  expect(registry.root).toBe("apps/plasmon");

  const paths = registry.boundaries.map((boundary) => boundary.path);
  expect(new Set(paths).size).toBe(paths.length);

  for (const boundary of registry.boundaries) {
    const directory = absoluteRepoPath(boundary.path);
    expect(existsSync(directory)).toBe(true);
    expect(existsSync(resolve(directory, "README.md"))).toBe(true);

    if (boundary.agents.mode === "local") {
      expect(existsSync(resolve(directory, "AGENTS.md"))).toBe(true);
      continue;
    }

    const inherited = absoluteRepoPath(boundary.agents.from);
    expect(existsSync(inherited)).toBe(true);
    expect(directory.startsWith(`${dirname(inherited)}${sep}`)).toBe(true);
  }
});

test("current documentation boundaries and discovery roots stay classified", () => {
  const registry = loadRegistry();
  const paths = new Set(registry.boundaries.map((boundary) => boundary.path));

  for (const root of registry.discoveryRoots) {
    const classified = new Set([
      ...registry.boundaries
        .filter((boundary) => dirname(boundary.path) === root.path)
        .map((boundary) => boundary.path.slice(root.path.length + 1)),
      ...root.nonBoundaryChildren,
    ]);
    expect(childDirectories(root.path).filter((child) => !classified.has(child))).toEqual([]);
  }

  for (const path of findAgentBoundaries("apps/plasmon/src")) {
    expect(paths.has(path)).toBe(true);
  }

  expect(paths.has("apps/plasmon/src/demo")).toBe(true);
  expect(paths.has("apps/plasmon/src/native-apps/shared")).toBe(false);
  expect(paths.has("apps/plasmon/src/native-apps/shared/monaco")).toBe(true);
  expect(paths.has("apps/plasmon/src/os/sharing")).toBe(true);
  expect(paths.has("apps/plasmon/src/native-apps/emulatorjs")).toBe(true);
  expect(paths.has("apps/plasmon/src/platform")).toBe(false);
  expect(paths.has("apps/plasmon/src/gui2")).toBe(false);
  expect(paths.has("apps/plasmon/docs/history")).toBe(false);

  const docsMap = readFileSync(resolve(appRoot, "docs/README.md"), "utf8");
  expect(docsMap).toContain("[`documentation-boundaries.json`](documentation-boundaries.json)");
  expect(docsMap).not.toContain("docs/history");
  expect(docsMap).not.toContain("](history/)");
});

test("current authority remains present without a repository history-document archive", () => {
  for (const path of requiredCurrentDocuments) {
    expect(existsSync(absoluteRepoPath(path))).toBe(true);
  }

  expect(existsSync(absoluteRepoPath("apps/plasmon/docs/history"))).toBe(false);

  const docsMap = readFileSync(resolve(appRoot, "docs/README.md"), "utf8");
  expect(docsMap).toContain("[`FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md`](FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md)");
  expect(docsMap).toContain("[`atoms/README.md`](atoms/README.md)");

  const currentArchitecture = readFileSync(
    resolve(appRoot, "docs/FILESYSTEM_DESKTOP_UX_ARCHITECTURE.md"),
    "utf8",
  );
  expect(currentArchitecture).toContain("Status: current normative cross-subsystem architecture");
});
