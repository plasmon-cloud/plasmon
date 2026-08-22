import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocumentationBoundaryRegistry } from "./documentation-boundaries.mjs";

export const REVIEW_MARKER_VERSION = "v1";
export const REVIEW_MARKER_PATTERN = /<!-- plasmon-docs-review:v1 sha256=([0-9a-f]{64}) base=([0-9a-f]{40}) -->/;

const modulePath = fileURLToPath(import.meta.url);
export const defaultRepoRoot = resolve(dirname(modulePath), "../../..");

function slash(path) {
  return path.replaceAll("\\", "/");
}

function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitZ(repoRoot, args) {
  const output = execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.split("\0").filter(Boolean).map(slash);
}

function fileBytes(path) {
  const stat = lstatSync(path);
  return stat.isSymbolicLink() ? Buffer.from(readlinkSync(path)) : readFileSync(path);
}

export function gitBlobIdentity(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha1")
    .update(`blob ${body.length}\0`)
    .update(body)
    .digest("hex");
}

export function nearestBoundaryForPath(path, registry) {
  const normalized = slash(path);
  let winner = null;
  for (const boundary of registry.boundaries) {
    if (normalized === boundary.path || normalized.startsWith(`${boundary.path}/`)) {
      if (!winner || boundary.path.length > winner.path.length) winner = boundary;
    }
  }
  return winner;
}

export function isBoundaryDocumentationFile(path, boundary) {
  return path === `${boundary.path}/README.md` || path === `${boundary.path}/AGENTS.md`;
}

export function listRepositoryFiles(repoRoot = defaultRepoRoot) {
  return gitZ(repoRoot, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "apps/plasmon",
  ]);
}

export function ownedImplementationFiles(boundaryPath, registry, files) {
  return files
    .filter((path) => {
      const owner = nearestBoundaryForPath(path, registry);
      return owner?.path === boundaryPath && !isBoundaryDocumentationFile(path, owner);
    })
    .sort();
}

export function computeOwnedFingerprint(
  boundaryPath,
  registry,
  repoRoot = defaultRepoRoot,
  files = listRepositoryFiles(repoRoot),
) {
  const hash = createHash("sha256");
  const ownedFiles = ownedImplementationFiles(boundaryPath, registry, files);
  for (const path of ownedFiles) {
    const absolute = resolve(repoRoot, path);
    if (!existsSync(absolute)) continue;
    hash.update(path);
    hash.update("\0");
    hash.update(gitBlobIdentity(fileBytes(absolute)));
    hash.update("\n");
  }
  return { digest: hash.digest("hex"), files: ownedFiles };
}

export function parseReviewMarker(readme) {
  const match = readme.match(REVIEW_MARKER_PATTERN);
  return match ? { digest: match[1], base: match[2] } : null;
}

export function formatReviewMarker(digest, base) {
  return `<!-- plasmon-docs-review:${REVIEW_MARKER_VERSION} sha256=${digest} base=${base} -->`;
}

export function upsertReviewMarker(readme, digest, base) {
  const marker = formatReviewMarker(digest, base);
  if (REVIEW_MARKER_PATTERN.test(readme)) return readme.replace(REVIEW_MARKER_PATTERN, marker);

  const lines = readme.split("\n");
  const heading = lines.findIndex((line) => /^#\s+/.test(line));
  if (heading === -1) return `${marker}\n${readme}`;
  lines.splice(heading + 1, 0, "", marker);
  return lines.join("\n");
}

function headSha(repoRoot) {
  return git(repoRoot, ["rev-parse", "HEAD"]);
}

function changedPathsSince(base, repoRoot) {
  try {
    return gitZ(repoRoot, ["diff", "--name-only", "-z", base, "--", "apps/plasmon"]);
  } catch {
    return [];
  }
}

function untrackedPaths(repoRoot) {
  return gitZ(repoRoot, ["ls-files", "-z", "--others", "--exclude-standard", "--", "apps/plasmon"]);
}

export function representativeChangedFiles(boundaryPath, registry, repoRoot, marker, currentFiles, limit = 5) {
  const candidate = marker
    ? [...changedPathsSince(marker.base, repoRoot), ...untrackedPaths(repoRoot)]
    : currentFiles;
  return [...new Set(ownedImplementationFiles(boundaryPath, registry, candidate))].slice(0, limit);
}

export function documentationReviewStatus(registry, repoRoot = defaultRepoRoot) {
  const files = listRepositoryFiles(repoRoot);
  const status = [];

  for (const boundary of registry.boundaries) {
    const readmePath = resolve(repoRoot, boundary.path, "README.md");
    const readme = readFileSync(readmePath, "utf8");
    const marker = parseReviewMarker(readme);
    const state = computeOwnedFingerprint(boundary.path, registry, repoRoot, files);
    const stale = !marker || marker.digest !== state.digest;
    status.push({
      boundary: boundary.path,
      digest: state.digest,
      marker,
      stale,
      changedFiles: stale
        ? representativeChangedFiles(boundary.path, registry, repoRoot, marker, state.files)
        : [],
    });
  }

  return status;
}

export function prepareDocumentationReview(boundaryPath, registry, repoRoot = defaultRepoRoot) {
  const boundary = registry.boundaries.find((entry) => entry.path === boundaryPath);
  if (!boundary) throw new Error(`${boundaryPath}: not a declared documentation boundary`);

  const files = listRepositoryFiles(repoRoot);
  const readmePath = resolve(repoRoot, boundary.path, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const previous = parseReviewMarker(readme);
  const state = computeOwnedFingerprint(boundary.path, registry, repoRoot, files);
  const changedFiles = representativeChangedFiles(boundary.path, registry, repoRoot, previous, state.files, 20);
  const base = headSha(repoRoot);
  return {
    boundary: boundary.path,
    digest: state.digest,
    base,
    changedFiles,
    previous,
    readmePath,
    updatedReadme: upsertReviewMarker(readme, state.digest, base),
  };
}

export function reviewDocumentationBoundary(boundaryPath, registry, repoRoot = defaultRepoRoot, options = {}) {
  const review = prepareDocumentationReview(boundaryPath, registry, repoRoot);
  options.beforeWrite?.(review);
  writeFileSync(review.readmePath, review.updatedReadme);
  return review;
}

export function printStatus(status) {
  const stale = status.filter((entry) => entry.stale);
  if (stale.length === 0) {
    console.log(`Documentation review fingerprints current: ${status.length} boundaries.`);
    return 0;
  }

  for (const entry of stale) {
    const reason = entry.marker ? "owned implementation changed" : "review marker missing";
    console.error(`STALE ${entry.boundary}: ${reason}`);
    for (const path of entry.changedFiles) console.error(`  - ${path}`);
    console.error(`  run: npm --workspace neutron-plasmon run docs:review -- ${entry.boundary}`);
  }
  return 1;
}

function printReviewSurface(review) {
  console.log(`Review surface for ${review.boundary}:`);
  if (review.changedFiles.length === 0) {
    console.log("  (no owned implementation changes since the previous review base)");
  }
  for (const path of review.changedFiles) console.log(`  - ${path}`);
  console.log("If the README/AGENTS remain accurate, refreshing the marker is a valid marker-only acknowledgement.");
}

function runCli() {
  const registry = loadDocumentationBoundaryRegistry();
  const command = process.argv[2] ?? "status";

  if (command === "status") {
    process.exitCode = printStatus(documentationReviewStatus(registry));
    return;
  }

  if (command === "review") {
    const boundaryPath = process.argv[3];
    if (!boundaryPath) {
      console.error("Usage: bun docs/documentation-review.mjs review <boundary>");
      process.exitCode = 2;
      return;
    }
    const result = reviewDocumentationBoundary(boundaryPath, registry, defaultRepoRoot, {
      beforeWrite: printReviewSurface,
    });
    console.log(`Updated ${result.boundary}/README.md`);
    console.log(`  sha256=${result.digest}`);
    console.log(`  base=${result.base}`);
    console.log("This marker records an explicit documentation review acknowledgement; it does not prove semantic correctness.");
    return;
  }

  console.error("Usage: bun docs/documentation-review.mjs [status|review <boundary>]");
  process.exitCode = 2;
}

if (resolve(process.argv[1] ?? "") === modulePath) runCli();
