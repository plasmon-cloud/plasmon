import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import {
  APPS_PATH,
  classifyResource,
  readNeutronAppMetadata,
  readResourceArtworkMetadata,
  readSharedShortcut,
} from "../fs/index.ts";
import {
  composeShortcutPresentation,
  type ResourceIconPresentation,
} from "../visual/index.ts";
import {
  applicationResourcePresentation,
  nativeHandlerResourcePresentation,
  resourcePresentationForClassification,
} from "../visual/resource-presentation.ts";

export type FileVisualKind = "folder" | "text" | "markdown" | "image" | "video" | "shortcut" | "atom" | "unknown";

export function fileVisualKind(node: FsNode): FileVisualKind {
  const classification = classifyResource(node);
  if (classification.kind === "directory") return "folder";
  if (classification.kind === "atom" || node.name.toLowerCase().endsWith(".atom")) return "atom";
  if (classification.kind === "shortcut" || node.name.toLowerCase().endsWith(".url")) return "shortcut";
  switch (classification.type.contentKind) {
    case "markdown": return "markdown";
    case "image": return "image";
    case "video": return "video";
    case "text":
    case "source":
      return "text";
    default:
      return "unknown";
  }
}

/** Maps an already-classified filesystem resource onto shared Visual identity. */
export function resourceIconPresentationForFile(node: FsNode): ResourceIconPresentation {
  return resourcePresentationForClassification(classifyResource(node), {
    artwork: readResourceArtworkMetadata(node),
  });
}

export interface FileResourcePresentation {
  presentation: ResourceIconPresentation;
  shortcut: boolean;
}

/**
 * Resolve direct resource identity from authoritative filesystem/application metadata.
 * Association lookup is metadata-only here: no matching, default selection, or opening occurs.
 */
export function directFileResourcePresentation(
  node: FsNode,
  associations?: AssociationRegistry,
): ResourceIconPresentation {
  const classification = classifyResource(node);
  const nativeIcon = classification.systemApp
    ? associations?.getHandler(classification.systemApp.handlerId)?.icon
    : undefined;
  return resourcePresentationForClassification(classification, {
    nativeIcon,
    artwork: readResourceArtworkMetadata(node),
  });
}

/** Safe synchronous presentation used immediately and whenever richer target lookup fails. */
export function fallbackFileResourcePresentation(
  node: FsNode,
  associations?: AssociationRegistry,
): FileResourcePresentation {
  const classification = classifyResource(node);
  const direct = directFileResourcePresentation(node, associations);
  if (classification.kind !== "shortcut") return { presentation: direct, shortcut: false };
  const composed = composeShortcutPresentation(direct);
  return { presentation: composed.target, shortcut: composed.shortcut };
}

async function neutronElementPresentation(
  fs: FsService,
  elementId: string,
): Promise<ResourceIconPresentation> {
  const apps = await fs.resolvePath(APPS_PATH);
  if (!apps || apps.kind !== "directory") return applicationResourcePresentation();
  const projections = await fs.list(apps.id, { includeHidden: true, sort: "name" });
  const projection = projections.find((candidate) => readNeutronAppMetadata(candidate)?.elementId === elementId);
  return projection ? directFileResourcePresentation(projection) : applicationResourcePresentation();
}

function nativeShortcutPresentation(
  handlerId: string,
  associations?: AssociationRegistry,
): ResourceIconPresentation {
  return nativeHandlerResourcePresentation(handlerId, associations?.getHandler(handlerId)?.icon);
}

async function tryShortcutTargetPresentation(
  fs: FsService,
  node: FsNode,
  associations: AssociationRegistry | undefined,
  visited: ReadonlySet<string>,
): Promise<ResourceIconPresentation | null> {
  const shortcut = readSharedShortcut(node);
  if (!shortcut) return resourceIconPresentationForFile(node);

  try {
    switch (shortcut.target.kind) {
      case "native":
        return nativeShortcutPresentation(shortcut.target.handlerId, associations);
      case "element":
        return await neutronElementPresentation(fs, shortcut.target.elementId);
      case "node": {
        if (visited.has(shortcut.target.nodeId)) return { kind: "file-type", icon: "file" };
        const target = await fs.stat(shortcut.target.nodeId);
        const nextVisited = new Set(visited);
        nextVisited.add(node.id);
        const resolved = await tryResolveFileResourcePresentation(fs, target, associations, nextVisited);
        return resolved?.presentation ?? null;
      }
      case "url":
        return { kind: "file-type", icon: "file" };
    }
  } catch {
    // The canonical public resolver below still supplies its deterministic
    // fallback. Returning null here lets a mounted FileEntry distinguish
    // unavailable asynchronous enrichment from authoritative generic artwork.
    return null;
  }
}

/**
 * Resolve presentation only when asynchronous shortcut enrichment is currently
 * available. A null result is not a generic-file presentation: callers that
 * already have a last-known presentation may keep it without causing packaged
 * image source churn. Genuinely new entries still initialize from the safe
 * synchronous fallback.
 */
export async function tryResolveFileResourcePresentation(
  fs: FsService,
  node: FsNode,
  associations?: AssociationRegistry,
  visited: ReadonlySet<string> = new Set(),
): Promise<FileResourcePresentation | null> {
  if (classifyResource(node).kind !== "shortcut") {
    return { presentation: directFileResourcePresentation(node, associations), shortcut: false };
  }

  if (visited.has(node.id)) return fallbackFileResourcePresentation(node, associations);
  const target = await tryShortcutTargetPresentation(fs, node, associations, visited);
  if (!target) return null;
  const composed = composeShortcutPresentation(target);
  return { presentation: composed.target, shortcut: composed.shortcut };
}

/**
 * FileManager production seam from resource semantics to the shared Visual presentation vocabulary.
 * Shortcut targets are inspected only for presentation metadata; this never dispatches or executes them.
 * Direct callers retain deterministic fallback semantics when target enrichment is unavailable.
 */
export async function resolveFileResourcePresentation(
  fs: FsService,
  node: FsNode,
  associations?: AssociationRegistry,
  visited: ReadonlySet<string> = new Set(),
): Promise<FileResourcePresentation> {
  return await tryResolveFileResourcePresentation(fs, node, associations, visited)
    ?? fallbackFileResourcePresentation(node, associations);
}
