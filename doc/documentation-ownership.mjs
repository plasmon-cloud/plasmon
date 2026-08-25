import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const registryRelativePath = "doc/documentation-ownership.json";
export const mapRelativePath = "doc/repository-map.md";
export const MAP_START = "<!-- neutron-repository-documentation-map:start -->";
export const MAP_END = "<!-- neutron-repository-documentation-map:end -->";

const modulePath = fileURLToPath(import.meta.url);
export const defaultRepoRoot = resolve(dirname(modulePath), "..");

function absolute(repoRoot, repoPath) {
  return resolve(repoRoot, repoPath);
}

function isDirectory(repoRoot, repoPath) {
  const path = absolute(repoRoot, repoPath);
  return existsSync(path) && statSync(path).isDirectory();
}

function isFile(repoRoot, repoPath) {
  const path = absolute(repoRoot, repoPath);
  return existsSync(path) && statSync(path).isFile();
}

function isStrictAncestor(ancestor, descendant) {
  const rel = relative(ancestor, descendant);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`);
}

function normalizePath(value) {
  return typeof value === "string" && value.length > 0
    ? value.replaceAll("\\", "/")
    : null;
}

export function loadDocumentationOwnershipRegistry(repoRoot = defaultRepoRoot) {
  return JSON.parse(readFileSync(absolute(repoRoot, registryRelativePath), "utf8"));
}

function addError(errors, message) {
  errors.push(message);
}

function validateDelegatedContract(boundary, repoRoot, errors) {
  const delegated = boundary.delegatedContract;
  if (!delegated || typeof delegated !== "object") {
    addError(errors, `${boundary.path}: delegated boundary is missing delegatedContract metadata.`);
    return;
  }

  const registryPath = normalizePath(delegated.registry);
  const mapPath = normalizePath(delegated.map);
  const delegatedRoot = normalizePath(delegated.root);
  if (!registryPath || !isFile(repoRoot, registryPath)) {
    addError(errors, `${boundary.path}: delegated registry ${String(delegated.registry)} is missing; point to an existing nested registry.`);
  } else {
    try {
      const nested = JSON.parse(readFileSync(absolute(repoRoot, registryPath), "utf8"));
      if (nested.schema !== "plasmon-documentation-boundaries-v1") {
        addError(errors, `${boundary.path}: delegated registry ${registryPath} has an unexpected schema.`);
      }
      if (nested.root !== delegatedRoot) {
        addError(errors, `${boundary.path}: delegated registry ${registryPath} root must be ${delegatedRoot}.`);
      }
      if (!Array.isArray(nested.boundaries) || nested.boundaries.length === 0) {
        addError(errors, `${boundary.path}: delegated registry ${registryPath} has no boundary entries.`);
      }
    } catch (error) {
      addError(errors, `${boundary.path}: delegated registry ${registryPath} is not valid JSON: ${error.message}`);
    }
  }
  if (!mapPath || !isFile(repoRoot, mapPath)) {
    addError(errors, `${boundary.path}: delegated documentation map ${String(delegated.map)} is missing.`);
  }
  if (!delegatedRoot || !isDirectory(repoRoot, delegatedRoot)) {
    addError(errors, `${boundary.path}: delegated root ${String(delegated.root)} is missing.`);
  }
}

export function validateDocumentationOwnership(registry, repoRoot = defaultRepoRoot) {
  const errors = [];
  if (registry?.schema !== "neutron-repository-documentation-ownership-v1") {
    addError(errors, `registry: expected schema neutron-repository-documentation-ownership-v1.`);
  }
  if (registry?.root !== ".") addError(errors, "registry: root must be the repository root \".\".");
  if (!Array.isArray(registry?.boundaries)) {
    addError(errors, "registry: boundaries must be an array.");
    return errors;
  }
  if (!Array.isArray(registry?.discoveryRoots)) {
    addError(errors, "registry: discoveryRoots must be an array.");
    return errors;
  }

  const boundaryPaths = registry.boundaries.map((boundary) => boundary.path);
  const duplicateBoundaries = boundaryPaths.filter((path, index) => boundaryPaths.indexOf(path) !== index);
  if (duplicateBoundaries.length > 0) {
    addError(errors, `registry: duplicate boundary path(s): ${[...new Set(duplicateBoundaries)].join(", ")}.`);
  }

  const declared = new Set(boundaryPaths);
  const documentationOwners = new Map();
  for (const boundary of registry.boundaries) {
    const boundaryPath = normalizePath(boundary.path);
    if (!boundaryPath) {
      addError(errors, "registry: every boundary needs a non-empty path.");
      continue;
    }
    if (!isDirectory(repoRoot, boundaryPath)) {
      addError(errors, `${boundaryPath}: declared boundary directory is missing; restore it or remove/reclassify the entry.`);
      continue;
    }
    if (typeof boundary.kind !== "string" || boundary.kind.length === 0) {
      addError(errors, `${boundaryPath}: boundary kind is missing.`);
    }
    if (!Array.isArray(boundary.documentation) || boundary.documentation.length === 0) {
      addError(errors, `${boundaryPath}: at least one owning documentation file is required.`);
    } else {
      for (const owner of boundary.documentation) {
        const ownerPath = normalizePath(owner?.path);
        const mode = owner?.mode;
        if (!ownerPath || !["local", "canonical", "delegated"].includes(mode)) {
          addError(errors, `${boundaryPath}: every documentation owner needs a path and mode local, canonical, or delegated.`);
          continue;
        }
        if (!isFile(repoRoot, ownerPath)) {
          addError(errors, `${boundaryPath}: owning documentation ${ownerPath} is missing; add it or correct the registry.`);
          continue;
        }
        const prior = documentationOwners.get(ownerPath) ?? [];
        prior.push({ boundaryPath, mode, shared: owner.shared === true });
        documentationOwners.set(ownerPath, prior);
      }
    }
    if (boundary.kind === "delegated-application") validateDelegatedContract(boundary, repoRoot, errors);
    if (boundary.delegatedContract && boundary.kind !== "delegated-application") {
      addError(errors, `${boundaryPath}: delegatedContract is only valid for delegated-application boundaries.`);
    }
  }

  for (const [ownerPath, owners] of documentationOwners) {
    if (owners.length < 2) continue;
    if (owners.some((owner) => !owner.shared) || owners.some((owner) => owner.mode === "local")) {
      addError(errors, `${ownerPath}: documentation is ambiguously owned by ${owners.map((owner) => owner.boundaryPath).join(", ")}; use one owner or mark a canonical shared owner explicitly.`);
    }
  }

  for (const root of registry.discoveryRoots) {
    const rootPath = normalizePath(root?.path);
    if (!rootPath || !isDirectory(repoRoot, rootPath)) {
      addError(errors, `${String(root?.path)}: discovery root is missing; restore it or remove the declaration.`);
      continue;
    }
    if (root.children !== "directories") {
      addError(errors, `${rootPath}: unsupported discovery mode ${JSON.stringify(root.children)}; use directories.`);
      continue;
    }
    const excluded = new Map();
    for (const item of root.excluded ?? []) {
      const path = normalizePath(item?.path);
      if (!path || typeof item?.kind !== "string" || typeof item?.reason !== "string") {
        addError(errors, `${rootPath}: every exclusion needs path, kind, and reason.`);
        continue;
      }
      excluded.set(path, item);
      if (!isDirectory(repoRoot, path)) addError(errors, `${path}: excluded classification points to a missing directory.`);
      if (declared.has(path)) addError(errors, `${path}: a directory cannot be both excluded and a declared boundary.`);
    }
    const directChildren = readdirSync(absolute(repoRoot, rootPath), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${rootPath}/${entry.name}`)
      .sort();
    for (const childPath of directChildren) {
      if (!declared.has(childPath) && !excluded.has(childPath)) {
        addError(errors, `${childPath}: unclassified direct child under ${rootPath}; add a boundary or an explicit exclusion with kind and reason.`);
      }
    }
    for (const excludedPath of excluded.keys()) {
      if (!directChildren.includes(excludedPath)) addError(errors, `${excludedPath}: exclusion is stale; remove it or restore the directory.`);
    }
  }

  return errors;
}

function mapRelativeLink(repoRoot, documentationPath) {
  const mapPath = absolute(repoRoot, mapRelativePath);
  const target = absolute(repoRoot, documentationPath);
  const rel = relative(dirname(mapPath), target).replaceAll(sep, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function linkFromMap(repoRoot, documentationPath) {
  return `[${documentationPath}](${mapRelativeLink(repoRoot, documentationPath)})`;
}

export function renderRepositoryDocumentationMap(registry, repoRoot = defaultRepoRoot) {
  const lines = [
    "# Repository documentation map",
    "",
    "This map is generated from [`documentation-ownership.json`](documentation-ownership.json). It covers maintained repository boundaries and points to their owning documentation. Structural validation does not claim that prose is semantically current; durable behavior, authority, contract, operational, and navigation changes still require normal documentation review.",
    "",
    MAP_START,
    "<!-- Generated from documentation-ownership.json by documentation-ownership.mjs. Do not edit this table by hand. -->",
    "| Boundary | Role | Owning documentation | Delegation |",
    "| --- | --- | --- | --- |",
  ];
  for (const boundary of registry.boundaries) {
    const docs = boundary.documentation.map((owner) => linkFromMap(repoRoot, owner.path)).join("<br>");
    const delegation = boundary.delegatedContract
      ? `[nested registry](${mapRelativeLink(repoRoot, boundary.delegatedContract.registry)}) / [map](${mapRelativeLink(repoRoot, boundary.delegatedContract.map)})`
      : "—";
    lines.push(`| \`${boundary.path}\` | ${boundary.kind} | ${docs} | ${delegation} |`);
  }
  lines.push(MAP_END, "");
  return lines.join("\n");
}

export function replaceRepositoryDocumentationMap(markdown, registry, repoRoot = defaultRepoRoot) {
  const generated = renderRepositoryDocumentationMap(registry, repoRoot).trimEnd();
  const start = markdown.indexOf(MAP_START);
  const end = markdown.indexOf(MAP_END);
  if (start < 0 || end < start) {
    throw new Error(`documentation map is missing stable markers ${MAP_START} / ${MAP_END}`);
  }
  const endOffset = end + MAP_END.length;
  const before = markdown.slice(0, start);
  const after = markdown.slice(endOffset);
  return `${before}${generated.slice(generated.indexOf(MAP_START))}${after}`;
}

export function validateRepositoryDocumentationMap(markdown, registry, repoRoot = defaultRepoRoot) {
  let expected;
  try {
    expected = replaceRepositoryDocumentationMap(markdown, registry, repoRoot);
  } catch (error) {
    return [String(error instanceof Error ? error.message : error)];
  }
  return expected === markdown
    ? []
    : [`${mapRelativePath}: generated documentation map is stale; run \`node doc/documentation-ownership.mjs generate\`.`];
}

function fail(errors) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function runCli() {
  const command = process.argv[2] ?? "check";
  const registry = loadDocumentationOwnershipRegistry();
  const structuralErrors = validateDocumentationOwnership(registry);
  if (structuralErrors.length > 0) {
    fail(structuralErrors);
    return;
  }
  const mapPath = absolute(defaultRepoRoot, mapRelativePath);
  const markdown = readFileSync(mapPath, "utf8");
  if (command === "generate") {
    writeFileSync(mapPath, replaceRepositoryDocumentationMap(markdown, registry));
    console.log(`Updated ${mapRelativePath} from ${registryRelativePath}`);
    return;
  }
  if (command === "check") {
    const mapErrors = validateRepositoryDocumentationMap(markdown, registry);
    if (mapErrors.length > 0) {
      fail(mapErrors);
      return;
    }
    console.log(`Repository documentation ownership valid: ${registry.boundaries.length} boundaries, ${registry.discoveryRoots.length} discovery roots.`);
    return;
  }
  console.error("Usage: node doc/documentation-ownership.mjs [check|generate]");
  process.exitCode = 2;
}

if (resolve(process.argv[1] ?? "") === modulePath) runCli();
