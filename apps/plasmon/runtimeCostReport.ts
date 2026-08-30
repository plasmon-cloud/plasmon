import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

export type RuntimeCostCategory =
  | "monaco"
  | "js-dos"
  | "emulatorjs"
  | "game-content"
  | "artwork-media"
  | "package-metadata"
  | "core-plasmon";

export interface RuntimeCostFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly category: RuntimeCostCategory;
}

export interface RuntimeCostCategoryTotal {
  readonly category: RuntimeCostCategory;
  readonly files: number;
  readonly bytes: number;
}

export interface RuntimeDuplicateGroup {
  readonly sha256: string;
  readonly bytesPerCopy: number;
  readonly copies: number;
  readonly duplicateBytes: number;
  readonly paths: readonly string[];
}

export interface RuntimeCostReport {
  readonly format: "plasmon-runtime-cost-report-v1";
  readonly root: string;
  readonly archive: null | {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
  };
  readonly files: readonly RuntimeCostFile[];
  readonly totals: {
    readonly files: number;
    readonly rawBytes: number;
    readonly duplicateBytes: number;
  };
  readonly categories: readonly RuntimeCostCategoryTotal[];
  readonly duplicateGroups: readonly RuntimeDuplicateGroup[];
}

const mediaExtensions = new Set([
  ".avif", ".gif", ".ico", ".jpeg", ".jpg", ".mp3", ".mp4", ".ogg", ".png", ".svg", ".wav", ".webm", ".webp",
]);

function slash(path: string): string {
  return path.replaceAll("\\", "/");
}

export function classifyRuntimeCostPath(path: string): RuntimeCostCategory {
  const normalized = `/${slash(path).replace(/^\/+/, "")}`;
  const lower = normalized.toLowerCase();
  if (lower.includes("/system/program files/monacoeditor/") || lower.includes("/runtime/monaco/")) return "monaco";
  if (lower.includes("/system/program files/js-dos/") || lower.includes("/runtime/jsdos/")) return "js-dos";
  if (lower.includes("/system/program files/emulatorjs/") || lower.includes("/runtime/emulatorjs/")) return "emulatorjs";
  if (
    lower.includes("/games/")
    || lower.includes("/fixtures/")
    || lower.endsWith(".jsdos")
    || lower.endsWith(".nes")
    || lower.endsWith(".rom")
  ) return "game-content";
  if (lower.includes("/static/plasmon/artwork/") || mediaExtensions.has(extname(lower))) return "artwork-media";
  if (
    lower === "/neutron.json"
    || lower === "/neutron.lock.json"
    || lower.startsWith("/mo/")
    || lower.includes("/pkg/")
  ) return "package-metadata";
  return "core-plasmon";
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function measureRuntimeCosts(
  root: string,
  options: { readonly archivePath?: string } = {},
): Promise<RuntimeCostReport> {
  const absoluteRoot = resolve(root);
  const paths = (await walk(absoluteRoot)).sort();
  const files: RuntimeCostFile[] = [];
  for (const path of paths) {
    const bytes = new Uint8Array(await readFile(path));
    const relativePath = slash(relative(absoluteRoot, path));
    files.push(Object.freeze({
      path: relativePath,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      category: classifyRuntimeCostPath(relativePath),
    }));
  }

  const categories = new Map<RuntimeCostCategory, { files: number; bytes: number }>();
  for (const file of files) {
    const current = categories.get(file.category) ?? { files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += file.bytes;
    categories.set(file.category, current);
  }

  const byDigest = new Map<string, RuntimeCostFile[]>();
  for (const file of files) {
    const group = byDigest.get(file.sha256) ?? [];
    group.push(file);
    byDigest.set(file.sha256, group);
  }
  const duplicateGroups = [...byDigest.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([digest, group]) => Object.freeze({
      sha256: digest,
      bytesPerCopy: group[0].bytes,
      copies: group.length,
      duplicateBytes: group[0].bytes * (group.length - 1),
      paths: Object.freeze(group.map((file) => file.path).sort()),
    }))
    .sort((left, right) => right.duplicateBytes - left.duplicateBytes || left.sha256.localeCompare(right.sha256));

  let archive: RuntimeCostReport["archive"] = null;
  if (options.archivePath) {
    const archivePath = resolve(options.archivePath);
    const archiveBytes = new Uint8Array(await readFile(archivePath));
    const archiveStat = await stat(archivePath);
    archive = Object.freeze({
      path: archivePath,
      bytes: archiveStat.size,
      sha256: sha256(archiveBytes),
    });
  }

  return Object.freeze({
    format: "plasmon-runtime-cost-report-v1",
    root: absoluteRoot,
    archive,
    files: Object.freeze(files),
    totals: Object.freeze({
      files: files.length,
      rawBytes: files.reduce((total, file) => total + file.bytes, 0),
      duplicateBytes: duplicateGroups.reduce((total, group) => total + group.duplicateBytes, 0),
    }),
    categories: Object.freeze([...categories.entries()]
      .map(([category, total]) => Object.freeze({ category, ...total }))
      .sort((left, right) => right.bytes - left.bytes || left.category.localeCompare(right.category))),
    duplicateGroups: Object.freeze(duplicateGroups),
  });
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const root = argumentValue(args, "--root");
  if (!root) {
    process.stderr.write("Runtime cost report failed: --root is required\n");
    process.exitCode = 1;
  } else {
    measureRuntimeCosts(root, { archivePath: argumentValue(args, "--archive") })
      .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Runtime cost report failed: ${message}\n`);
        process.exitCode = 1;
      });
  }
}
