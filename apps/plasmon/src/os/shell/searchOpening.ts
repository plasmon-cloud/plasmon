import type {
  AssociationRegistry,
  FsNode,
  FsService,
  NodeId,
  OpenService,
} from "../contracts/index.ts";
import { OpenWithServiceModel } from "../associations/index.ts";

/** Match the bounded association inspection used by filesystem UI without importing its internals. */
export const SEARCH_ASSOCIATION_PROBE_BYTES = 256 * 1024;
const MAX_OPEN_WARNING_COUNT = 3;
const MAX_OPEN_WARNING_LENGTH = 180;

export function searchResultNeedsAssociationProbe(node: FsNode): boolean {
  const lower = node.name.toLowerCase();
  return node.kind === "shortcut"
    || node.kind === "atom"
    || lower.endsWith(".url")
    || lower.endsWith(".atom");
}

export async function readSearchAssociationProbe(
  fs: FsService,
  node: FsNode,
): Promise<Uint8Array | undefined> {
  if (!searchResultNeedsAssociationProbe(node)) return undefined;
  if (node.size <= 0) return new Uint8Array();
  return fs.read(node.id, {
    offset: 0,
    length: Math.min(node.size, SEARCH_ASSOCIATION_PROBE_BYTES),
  });
}

function boundedWarning(warning: string): string {
  return warning.length <= MAX_OPEN_WARNING_LENGTH
    ? warning
    : `${warning.slice(0, MAX_OPEN_WARNING_LENGTH - 1)}…`;
}

export class SearchResultInspectionError extends Error {
  readonly warnings: readonly string[];

  constructor(node: FsNode, warnings: readonly string[]) {
    const bounded = warnings.slice(0, MAX_OPEN_WARNING_COUNT).map(boundedWarning);
    const omitted = Math.max(0, warnings.length - bounded.length);
    super(
      `Could not inspect ${node.name}: ${bounded.join("; ")}${omitted > 0 ? `; ${omitted} more warning${omitted === 1 ? "" : "s"}` : ""}`,
    );
    this.name = "SearchResultInspectionError";
    this.warnings = bounded;
  }
}

/**
 * Opens a filesystem search result through the association subsystem's public
 * Open With model. Shell only decides whether a bounded probe is needed; it
 * never reproduces association precedence or parses resource formats itself.
 */
export async function openFilesystemSearchResult(
  fs: FsService,
  registry: AssociationRegistry,
  openService: OpenService,
  nodeId: NodeId,
): Promise<void> {
  const node = await fs.stat(nodeId);
  if (node.kind === "directory") {
    throw new Error("Directories are navigated by FileManager/Explorer");
  }

  const probe = await readSearchAssociationProbe(fs, node);
  const openWith = new OpenWithServiceModel(registry, openService);
  const resolved = await openWith.model(node, probe);
  if (resolved.warnings.length > 0) {
    throw new SearchResultInspectionError(node, resolved.warnings);
  }

  const handlerId = resolved.defaultHandlerId;
  if (!handlerId) {
    throw new Error(`No compatible application is registered for ${node.name}`);
  }

  await openWith.open(node, handlerId, probe);
}
