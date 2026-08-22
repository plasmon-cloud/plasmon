import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const BOUNDARY_TABLE_START = "<!-- plasmon-documentation-boundaries:start -->";
export const BOUNDARY_TABLE_END = "<!-- plasmon-documentation-boundaries:end -->";

const modulePath = fileURLToPath(import.meta.url);
export const defaultRepoRoot = resolve(dirname(modulePath), "../../..");
export const registryRelativePath = "apps/plasmon/docs/documentation-boundaries.json";
export const docsMapRelativePath = "apps/plasmon/docs/README.md";

function absolute(repoRoot, repoPath) {
  return resolve(repoRoot, repoPath);
}

function directoryExists(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function isStrictAncestor(ancestor, descendant) {
  const rel = relative(ancestor, descendant);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !resolve(descendant).startsWith(`${resolve(ancestor)}${sep}..${sep}`);
}

export function loadDocumentationBoundaryRegistry(repoRoot = defaultRepoRoot) {
  return JSON.parse(readFileSync(absolute(repoRoot, registryRelativePath), "utf8"));
}

export function validateDocumentationBoundaries(registry, repoRoot = defaultRepoRoot) {
  const errors = [];
  const boundaryPaths = registry.boundaries.map((boundary) => boundary.path);
  const duplicates = boundaryPaths.filter((path, index) => boundaryPaths.indexOf(path) !== index);

  if (new Set(boundaryPaths).size !== boundaryPaths.length) {
    errors.push(`registry: duplicate boundary path(s): ${[...new Set(duplicates)].join(", ")}; keep one authoritative entry per path.`);
  }

  for (const boundary of registry.boundaries) {
    const boundaryDirectory = absolute(repoRoot, boundary.path);
    if (!directoryExists(boundaryDirectory)) {
      errors.push(`${boundary.path}: declared boundary directory is missing; restore it or remove/reclassify the registry entry.`);
      continue;
    }

    if (boundary.readme === "local" && !existsSync(resolve(boundaryDirectory, "README.md"))) {
      errors.push(`${boundary.path}: required README.md is missing; add ${boundary.path}/README.md or change the boundary policy.`);
    }

    if (boundary.agents.mode === "local") {
      if (!existsSync(resolve(boundaryDirectory, "AGENTS.md"))) {
        errors.push(`${boundary.path}: required local AGENTS.md is missing; add ${boundary.path}/AGENTS.md or declare inherited ownership.`);
      }
      continue;
    }

    if (boundary.agents.mode !== "inherited") {
      errors.push(`${boundary.path}: unsupported agents.mode ${JSON.stringify(boundary.agents.mode)}; use "local" or "inherited".`);
      continue;
    }

    const ownerFile = absolute(repoRoot, boundary.agents.from);
    const ownerDirectory = dirname(ownerFile);
    if (basename(ownerFile) !== "AGENTS.md" || !existsSync(ownerFile)) {
      errors.push(`${boundary.path}: inherited AGENTS owner ${boundary.agents.from} does not resolve to an existing AGENTS.md; fix the "from" path.`);
      continue;
    }
    if (!isStrictAncestor(ownerDirectory, boundaryDirectory)) {
      errors.push(`${boundary.path}: inherited AGENTS owner ${boundary.agents.from} is not an ancestor; point "from" at the nearest applicable ancestor AGENTS.md.`);
    }
  }

  const declared = new Set(boundaryPaths);
  for (const root of registry.discoveryRoots) {
    const rootDirectory = absolute(repoRoot, root.path);
    if (!directoryExists(rootDirectory)) {
      errors.push(`${root.path}: discovery root is missing; restore it or remove the discovery-root declaration.`);
      continue;
    }

    const exemptions = new Set(root.nonBoundaryChildren ?? []);
    const directChildren = readdirSync(rootDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const child of directChildren) {
      const childPath = `${root.path}/${child}`;
      if (!declared.has(childPath) && !exemptions.has(child)) {
        errors.push(`${childPath}: unclassified direct child under ${root.path}; add a boundary entry or add ${JSON.stringify(child)} to nonBoundaryChildren if it is implementation-only.`);
      }
    }

    for (const exemption of exemptions) {
      if (!directChildren.includes(exemption)) {
        errors.push(`${root.path}/${exemption}: nonBoundaryChildren exemption is stale; remove it or restore the implementation-only directory.`);
      }
    }
  }

  return errors;
}

export function renderDocumentationBoundaryTable(registry) {
  const lines = [
    "| Boundary | Kind | README | AGENTS |",
    "| --- | --- | --- | --- |",
  ];

  for (const boundary of registry.boundaries) {
    const agents = boundary.agents.mode === "local"
      ? "local"
      : `inherited from \`${boundary.agents.from}\``;
    lines.push(`| \`${boundary.path}\` | ${boundary.kind} | ${boundary.readme} | ${agents} |`);
  }

  return lines.join("\n");
}

export function generatedBoundaryBlock(registry) {
  return [
    BOUNDARY_TABLE_START,
    "<!-- Generated from documentation-boundaries.json by documentation-boundaries.mjs. Do not edit this table by hand. -->",
    renderDocumentationBoundaryTable(registry),
    BOUNDARY_TABLE_END,
  ].join("\n");
}

export function replaceGeneratedBoundaryBlock(readme, registry) {
  const start = readme.indexOf(BOUNDARY_TABLE_START);
  const end = readme.indexOf(BOUNDARY_TABLE_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`documentation map is missing stable boundary markers ${BOUNDARY_TABLE_START} / ${BOUNDARY_TABLE_END}`);
  }
  const endOffset = end + BOUNDARY_TABLE_END.length;
  return `${readme.slice(0, start)}${generatedBoundaryBlock(registry)}${readme.slice(endOffset)}`;
}

export function validateDocumentationMap(readme, registry) {
  let generated;
  try {
    generated = replaceGeneratedBoundaryBlock(readme, registry);
  } catch (error) {
    return [String(error instanceof Error ? error.message : error)];
  }
  return generated === readme
    ? []
    : [`${docsMapRelativePath}: generated boundary table is stale; run \`npm --workspace neutron-plasmon run docs:boundaries:generate\`.`];
}

function fail(errors) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function runCli() {
  const command = process.argv[2] ?? "check";
  const registry = loadDocumentationBoundaryRegistry();
  const structuralErrors = validateDocumentationBoundaries(registry);
  if (structuralErrors.length > 0) {
    fail(structuralErrors);
    return;
  }

  const readmePath = absolute(defaultRepoRoot, docsMapRelativePath);
  const readme = readFileSync(readmePath, "utf8");

  if (command === "generate") {
    writeFileSync(readmePath, replaceGeneratedBoundaryBlock(readme, registry));
    console.log(`Updated ${docsMapRelativePath} from ${registryRelativePath}`);
    return;
  }

  if (command === "check") {
    const mapErrors = validateDocumentationMap(readme, registry);
    if (mapErrors.length > 0) {
      fail(mapErrors);
      return;
    }
    console.log(`Documentation boundaries valid: ${registry.boundaries.length} boundaries, ${registry.discoveryRoots.length} discovery roots.`);
    return;
  }

  console.error("Usage: bun docs/documentation-boundaries.mjs [check|generate]");
  process.exitCode = 2;
}

if (resolve(process.argv[1] ?? "") === modulePath) runCli();
