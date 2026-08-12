import type { FsNode, FsService, JsonValue } from "../contracts/index.ts";
import { OWNERSHIP_METADATA_KEY } from "./resourcePolicy.ts";

export const PROGRAM_FILES_PATH = "/System/Program Files";
export const PROGRAM_FILES_METADATA_KEY = "plasmon.programFiles";
export const PROGRAM_FILES_RECONCILIATION_VERSION = 1;

export interface ProgramFilesMetadata {
  format: "plasmon.program-files";
  version: 1;
}

export interface ProgramFilesService {
  root(): Promise<FsNode>;
  ensureRuntimeDirectory(name: string): Promise<FsNode>;
}

function programFilesMetadata(): JsonValue {
  return {
    format: "plasmon.program-files",
    version: PROGRAM_FILES_RECONCILIATION_VERSION,
  };
}

function hasCurrentProgramFilesMetadata(node: FsNode): boolean {
  const value = node.metadata[PROGRAM_FILES_METADATA_KEY];
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && value.format === "plasmon.program-files"
    && value.version === PROGRAM_FILES_RECONCILIATION_VERSION;
}

async function ensureSystemDirectory(fs: FsService): Promise<FsNode> {
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");

  let system = await fs.resolvePath("/System");
  if (!system) system = await fs.mkdir(root.id, "System");
  if (system.kind !== "directory") throw new Error("/System exists but is not a directory");
  if (system.metadata[OWNERSHIP_METADATA_KEY] !== "system-required") {
    system = await fs.setMetadata(system.id, { [OWNERSHIP_METADATA_KEY]: "system-required" });
  }
  return system;
}

/**
 * Establishes the canonical Program Files root without replacing its NodeId or
 * touching unrelated children. The metadata version belongs only to Plasmon's
 * filesystem representation; it is not an Element/package installation record.
 */
export async function reconcileProgramFilesRoot(fs: FsService): Promise<FsNode> {
  const system = await ensureSystemDirectory(fs);
  let programFiles = await fs.resolvePath(PROGRAM_FILES_PATH);
  if (!programFiles) programFiles = await fs.mkdir(system.id, "Program Files");
  if (programFiles.kind !== "directory") throw new Error(`${PROGRAM_FILES_PATH} exists but is not a directory`);

  const needsOwnership = programFiles.metadata[OWNERSHIP_METADATA_KEY] !== "system-required";
  const needsVersion = !hasCurrentProgramFilesMetadata(programFiles);
  if (!needsOwnership && !needsVersion) return programFiles;

  return fs.setMetadata(programFiles.id, {
    [OWNERSHIP_METADATA_KEY]: "system-required",
    [PROGRAM_FILES_METADATA_KEY]: programFilesMetadata(),
  });
}

function runtimeDirectoryName(name: string): string {
  if (!name || name.trim() !== name || name === "." || name === ".." || /[\\/\0]/u.test(name)) {
    throw new Error(`Invalid Program Files runtime directory name: ${name || "<empty>"}`);
  }
  return name;
}

/**
 * Filesystem-only seam for curated runtime owners. It creates/repairs one direct
 * child directory and preserves any existing contents. Runtime code owns the
 * subtree semantics and packaged assets; Filesystem owns only durable identity
 * and protection of the location.
 */
export async function reconcileProgramFilesRuntimeDirectory(
  fs: FsService,
  name: string,
): Promise<FsNode> {
  const canonicalName = runtimeDirectoryName(name);
  const programFiles = await reconcileProgramFilesRoot(fs);
  const children = await fs.list(programFiles.id, { includeHidden: true, sort: "name" });
  let directory = children.find(
    (node) => node.name.toLocaleLowerCase() === canonicalName.toLocaleLowerCase(),
  ) ?? null;

  if (!directory) directory = await fs.mkdir(programFiles.id, canonicalName);
  if (directory.kind !== "directory") {
    throw new Error(`${PROGRAM_FILES_PATH}/${directory.name} exists but is not a directory`);
  }
  if (directory.metadata[OWNERSHIP_METADATA_KEY] !== "system-required") {
    directory = await fs.setMetadata(directory.id, { [OWNERSHIP_METADATA_KEY]: "system-required" });
  }
  return directory;
}

export class ManagedProgramFilesService implements ProgramFilesService {
  constructor(
    private readonly fs: FsService,
    private readonly ready: Promise<unknown> = Promise.resolve(),
  ) {}

  async root(): Promise<FsNode> {
    await this.ready;
    return reconcileProgramFilesRoot(this.fs);
  }

  async ensureRuntimeDirectory(name: string): Promise<FsNode> {
    await this.ready;
    return reconcileProgramFilesRuntimeDirectory(this.fs, name);
  }
}
