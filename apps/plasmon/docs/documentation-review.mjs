import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
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

function gitFile(repoRoot, ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function gitCommitExists(repoRoot, sha) {
  return spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: repoRoot }).status === 0;
}

function gitIsAncestor(repoRoot, ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: repoRoot }).status === 0;
}

function fileBytes(path) {
  const stat = lstatSync(path);
  return stat.isSymbolicLink() ? Buffer.from(readlinkSync(path)) : readFileSync(path);
}

function normalizedDocumentationContent(path, content) {
  const withoutMarker = path.endsWith("/README.md")
    ? content.replace(REVIEW_MARKER_PATTERN, "")
    : content;
  return `${withoutMarker.replaceAll("\r\n", "\n").trimEnd()}\n`;
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

export function requiredDocumentationFiles(boundary) {
  const files = [`${boundary.path}/README.md`];
  if (boundary.agents?.mode === "local") files.push(`${boundary.path}/AGENTS.md`);
  return files;
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

function dirtyPaths(repoRoot) {
  const paths = [
    ...gitZ(repoRoot, ["diff", "--name-only", "-z", "--", "apps/plasmon"]),
    ...gitZ(repoRoot, ["diff", "--cached", "--name-only", "-z", "--", "apps/plasmon"]),
    ...untrackedPaths(repoRoot),
  ];
  return [...new Set(paths)];
}

function latestCommitTouching(repoRoot, base, paths) {
  if (paths.length === 0) return null;
  try {
    return git(repoRoot, ["log", "-1", "--format=%H", `${base}..HEAD`, "--", ...paths]) || null;
  } catch {
    return null;
  }
}

function substantiveDocumentationCommits(repoRoot, base, path) {
  let commits;
  try {
    commits = git(repoRoot, ["log", "--format=%H", `${base}..HEAD`, "--", path])
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }

  const result = [];
  for (const commit of commits) {
    const current = gitFile(repoRoot, commit, path);
    const previous = gitFile(repoRoot, `${commit}^`, path);
    if (current === null) continue;
    if (normalizedDocumentationContent(path, current) !== normalizedDocumentationContent(path, previous ?? "")) {
      result.push(commit);
    }
  }
  return result;
}

export function representativeChangedFiles(boundaryPath, registry, repoRoot, marker, currentFiles, limit = 5) {
  const candidate = marker
    ? [...changedPathsSince(marker.base, repoRoot), ...untrackedPaths(repoRoot)]
    : currentFiles;
  return [...new Set(ownedImplementationFiles(boundaryPath, registry, candidate))].slice(0, limit);
}

export function documentationMaintenanceSinceReview(
  boundary,
  marker,
  registry,
  repoRoot = defaultRepoRoot,
  currentFiles = listRepositoryFiles(repoRoot),
) {
  const requiredFiles = requiredDocumentationFiles(boundary);
  const ownedFiles = ownedImplementationFiles(boundary.path, registry, currentFiles);
  const changedOwnedFiles = marker
    ? ownedImplementationFiles(boundary.path, registry, changedPathsSince(marker.base, repoRoot))
    : [];
  const relevant = new Set([...ownedFiles, ...changedOwnedFiles, ...requiredFiles]);
  const uncommittedFiles = dirtyPaths(repoRoot).filter((path) => relevant.has(path));

  if (!marker) {
    return {
      baselineAvailable: true,
      changed: true,
      changedFiles: requiredFiles.filter((path) => existsSync(resolve(repoRoot, path))),
      requiredFiles,
      latestImplementationCommit: null,
      latestDocumentationCommit: null,
      uncommittedFiles,
    };
  }

  if (!gitCommitExists(repoRoot, marker.base)) {
    return {
      baselineAvailable: false,
      changed: false,
      changedFiles: [],
      requiredFiles,
      latestImplementationCommit: null,
      latestDocumentationCommit: null,
      uncommittedFiles,
    };
  }

  const latestImplementationCommit = latestCommitTouching(repoRoot, marker.base, changedOwnedFiles);
  const qualifying = [];
  for (const path of requiredFiles) {
    for (const commit of substantiveDocumentationCommits(repoRoot, marker.base, path)) {
      if (!latestImplementationCommit || gitIsAncestor(repoRoot, latestImplementationCommit, commit)) {
        qualifying.push({ path, commit });
        break;
      }
    }
  }

  return {
    baselineAvailable: true,
    changed: uncommittedFiles.length === 0 && qualifying.length > 0,
    changedFiles: [...new Set(qualifying.map((entry) => entry.path))],
    requiredFiles,
    latestImplementationCommit,
    latestDocumentationCommit: qualifying[0]?.commit ?? null,
    uncommittedFiles,
  };
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
    const documentation = stale
      ? documentationMaintenanceSinceReview(boundary, marker, registry, repoRoot, files)
      : {
          baselineAvailable: true,
          changed: false,
          changedFiles: [],
          requiredFiles: requiredDocumentationFiles(boundary),
          latestImplementationCommit: null,
          latestDocumentationCommit: null,
          uncommittedFiles: [],
        };
    status.push({
      boundary: boundary.path,
      digest: state.digest,
      marker,
      stale,
      changedFiles: stale
        ? representativeChangedFiles(boundary.path, registry, repoRoot, marker, state.files)
        : [],
      documentationBaselineAvailable: documentation.baselineAvailable,
      documentationChanged: documentation.changed,
      documentationChangedFiles: documentation.changedFiles,
      requiredDocumentationFiles: documentation.requiredFiles,
      latestImplementationCommit: documentation.latestImplementationCommit,
      latestDocumentationCommit: documentation.latestDocumentationCommit,
      uncommittedReviewFiles: documentation.uncommittedFiles,
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
  const documentation = documentationMaintenanceSinceReview(boundary, previous, registry, repoRoot, files);
  const base = headSha(repoRoot);
  return {
    boundary: boundary.path,
    digest: state.digest,
    base,
    changedFiles,
    previous,
    readmePath,
    updatedReadme: upsertReviewMarker(readme, state.digest, base),
    documentationBaselineAvailable: documentation.baselineAvailable,
    documentationChanged: documentation.changed,
    documentationChangedFiles: documentation.changedFiles,
    requiredDocumentationFiles: documentation.requiredFiles,
    latestImplementationCommit: documentation.latestImplementationCommit,
    latestDocumentationCommit: documentation.latestDocumentationCommit,
    uncommittedReviewFiles: documentation.uncommittedFiles,
  };
}

export function reviewDocumentationBoundary(boundaryPath, registry, repoRoot = defaultRepoRoot, options = {}) {
  const review = prepareDocumentationReview(boundaryPath, registry, repoRoot);
  options.beforeWrite?.(review);
  if (review.previous && !review.documentationBaselineAvailable) {
    throw new Error(
      `${review.boundary}: previous documentation baseline ${review.previous.base} is unavailable; refusing marker refresh. ` +
      "Use a repository checkout containing that history.",
    );
  }
  if (review.previous && review.uncommittedReviewFiles.length > 0) {
    throw new Error(
      `${review.boundary}: commit the owned implementation/documentation change surface before refreshing the marker: ` +
      review.uncommittedReviewFiles.join(", "),
    );
  }
  if (review.previous && !review.documentationChanged) {
    throw new Error(
      `${review.boundary}: no committed substantive owning-documentation edit exists at or after the latest owned implementation commit. ` +
      `Edit and commit ${review.requiredDocumentationFiles.join(" or ")} before refreshing the marker.`,
    );
  }
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
    if (entry.marker && !entry.documentationBaselineAvailable) {
      console.error(`  documentation baseline unavailable: ${entry.marker.base}`);
    } else if (entry.uncommittedReviewFiles.length > 0) {
      console.error(`  commit before review: ${entry.uncommittedReviewFiles.join(", ")}`);
    } else if (entry.marker && entry.documentationChangedFiles.length === 0) {
      console.error(`  required committed documentation edit: ${entry.requiredDocumentationFiles.join(" or ")}`);
    } else {
      for (const path of entry.documentationChangedFiles) console.error(`  documentation maintained: ${path}`);
    }
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
  console.log("Owning documentation maintenance:");
  if (!review.documentationBaselineAvailable) {
    console.log(`  baseline unavailable: ${review.previous?.base ?? "none"}`);
  } else if (review.uncommittedReviewFiles.length > 0) {
    console.log(`  COMMIT FIRST: ${review.uncommittedReviewFiles.join(", ")}`);
  } else if (review.documentationChangedFiles.length === 0) {
    console.log(`  REQUIRED: edit and commit ${review.requiredDocumentationFiles.join(" or ")}`);
  } else {
    for (const path of review.documentationChangedFiles) console.log(`  maintained: ${path}`);
    if (review.latestImplementationCommit) console.log(`  implementation commit: ${review.latestImplementationCommit}`);
    if (review.latestDocumentationCommit) console.log(`  documentation commit: ${review.latestDocumentationCommit}`);
  }
  console.log("A marker refresh is valid only after the implementation and substantive owning-documentation edit are committed.");
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
    try {
      const result = reviewDocumentationBoundary(boundaryPath, registry, defaultRepoRoot, {
        beforeWrite: printReviewSurface,
      });
      console.log(`Updated ${result.boundary}/README.md`);
      console.log(`  sha256=${result.digest}`);
      console.log(`  base=${result.base}`);
      console.log("This marker records that committed owned implementation and owning documentation were reviewed together; it does not prove semantic correctness.");
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  console.error("Usage: bun docs/documentation-review.mjs [status|review <boundary>]");
  process.exitCode = 2;
}

if (resolve(process.argv[1] ?? "") === modulePath) runCli();