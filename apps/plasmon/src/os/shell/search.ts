import type {
  ExternalElement,
  FsEventSource,
  FsNode,
  FsService,
  JsonValue,
  NativeAppDefinition,
} from "../contracts/index.ts";
import { classifyResource, type NeutronAppMetadata } from "../fs/index.ts";
import {
  parseStartShortcut,
  startShortcutTargetIdentity,
  type StartShortcutTarget,
} from "./startMenu.ts";

export type SearchTab = "all" | "apps" | "documents" | "media" | "atoms";
export type FsSearchCategory = Exclude<SearchTab, "all">;
export type FileSearchCategory = Exclude<FsSearchCategory, "apps">;

export const SEARCH_TOTAL_LIMIT = 48;
export const SEARCH_CATEGORY_LIMITS: Readonly<Record<Exclude<SearchTab, "all">, number>> = Object.freeze({
  apps: 14,
  documents: 12,
  media: 12,
  atoms: 10,
});

export interface NativeAppSearchResult {
  kind: "native-app";
  id: string;
  category: "apps";
  title: string;
  subtitle: string;
  app: NativeAppDefinition;
}

export interface ElementSearchResult {
  kind: "element";
  id: string;
  category: "apps";
  title: string;
  subtitle: string;
  element: ExternalElement;
}

export interface NeutronProjectionSearchResult {
  kind: "neutron-projection";
  id: string;
  category: "apps";
  title: string;
  subtitle: string;
  icon?: string;
  elementId: string;
  node: FsNode;
}

export interface StartShortcutSearchResult {
  kind: "start-shortcut";
  id: string;
  category: "apps";
  title: string;
  subtitle: string;
  node: FsNode;
  target: StartShortcutTarget;
}

export interface DirectorySearchResult {
  kind: "directory";
  id: string;
  category: "documents";
  title: string;
  subtitle: "Folder";
  node: FsNode;
}

export interface FileSearchResult {
  kind: "file";
  id: string;
  category: FileSearchCategory;
  title: string;
  subtitle: string;
  node: FsNode;
}

export type ShellSearchResult =
  | NativeAppSearchResult
  | ElementSearchResult
  | NeutronProjectionSearchResult
  | StartShortcutSearchResult
  | DirectorySearchResult
  | FileSearchResult;

export interface SearchBatch {
  results: ShellSearchResult[];
  warnings: string[];
  truncated: boolean;
}

export interface FilesystemSearchOptions {
  signal?: AbortSignal;
  maxNodes?: number;
  maxWarnings?: number;
}

export interface ShellSearchOptions extends FilesystemSearchOptions {
  pinnedNative?: readonly string[];
  pinnedElements?: readonly string[];
}

function abortError(): Error {
  const error = new Error("Search cancelled");
  error.name = "AbortError";
  return error;
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

function extension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index).toLocaleLowerCase() : "";
}

const MEDIA_EXTENSIONS = new Set([
  ".aac", ".avi", ".bmp", ".flac", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".m4a", ".m4v", ".mkv",
  ".mov", ".mp3", ".mp4", ".ogg", ".ogv", ".opus", ".png", ".svg", ".wav", ".webm", ".webp",
]);

function atomRecord(node: FsNode): Record<string, JsonValue> | null {
  const value = node.metadata.atom;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

function categorizeNonApplicationFsNode(node: FsNode): FileSearchCategory {
  const atom = atomRecord(node);
  if (node.kind === "atom" || atom?.format === "plasmon.atom" || extension(node.name) === ".atom") {
    return "atoms";
  }
  if (node.mime?.startsWith("audio/") || node.mime?.startsWith("image/") || node.mime?.startsWith("video/") || MEDIA_EXTENSIONS.has(extension(node.name))) {
    return "media";
  }
  return "documents";
}

export function categorizeFsNode(node: FsNode): FsSearchCategory {
  if (classifyResource(node).kind === "neutron-app") return "apps";
  return categorizeNonApplicationFsNode(node);
}

function metadataStrings(value: JsonValue, output: string[], budget: { remaining: number }): void {
  if (budget.remaining <= 0 || value === null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value);
    if (text.length) output.push(text.slice(0, budget.remaining));
    budget.remaining -= Math.min(text.length, budget.remaining);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) metadataStrings(item, output, budget);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (budget.remaining <= 0) break;
    output.push(key);
    budget.remaining -= Math.min(key.length, budget.remaining);
    metadataStrings(item, output, budget);
  }
}

export function searchableNodeText(node: FsNode): string {
  const parts = [node.name, node.kind, node.mime ?? ""];
  const budget = { remaining: 4096 };
  metadataStrings(node.metadata, parts, budget);
  return normalize(parts.join("\n"));
}

function fileSubtitle(node: FsNode, category: FileSearchCategory): string {
  if (category === "atoms") {
    const atom = atomRecord(node);
    const title = typeof atom?.title === "string" ? atom.title : null;
    const atomType = typeof atom?.atomType === "string" ? atom.atomType : null;
    return [title, atomType, "Atom"].filter(Boolean).join(" · ");
  }
  if (node.mime) return node.mime;
  return category === "media" ? "Media" : "Document";
}

function elementRuntimeLabel(running: ExternalElement["running"]): string {
  switch (running) {
    case "yes": return "Running";
    case "no": return "Not running";
    case "unknown": return "Runtime status unavailable";
  }
}

function elementSubtitle(element: ExternalElement): string {
  const description = element.description.trim() || "Neutron application";
  return `${description} · ${elementRuntimeLabel(element.running)}`;
}

function projectionSearchResult(node: FsNode, metadata: NeutronAppMetadata): NeutronProjectionSearchResult {
  return {
    kind: "neutron-projection",
    id: `element:${metadata.elementId}`,
    category: "apps",
    title: metadata.name ?? metadata.elementId,
    subtitle: metadata.description ?? "Neutron application",
    ...(metadata.icon ? { icon: metadata.icon } : {}),
    elementId: metadata.elementId,
    node,
  };
}

function withElementPresentation(
  projection: NeutronProjectionSearchResult,
  element: ExternalElement | undefined,
): NeutronProjectionSearchResult {
  if (!element) return projection;
  return {
    ...projection,
    title: element.name,
    subtitle: elementSubtitle(element),
    ...(element.icon ? { icon: element.icon } : {}),
  };
}

export function searchApplicationIcon(result: ShellSearchResult): NativeAppDefinition["icon"] | string | undefined {
  switch (result.kind) {
    case "native-app": return result.app.icon;
    case "element": return result.element.icon;
    case "neutron-projection": return result.icon;
    default: return undefined;
  }
}

function shortcutSubtitle(target: StartShortcutTarget): string {
  switch (target.kind) {
    case "native": return `Start shortcut · ${target.handlerId}`;
    case "element": return `Start shortcut · Neutron Element ${target.elementId}`;
    case "node": return "Start shortcut · filesystem item";
    case "url": return "Start shortcut · URL";
  }
}

function matches(haystack: string, needle: string): boolean {
  const terms = normalize(needle).trim().split(/\s+/u).filter(Boolean);
  return terms.length === 0 || terms.every((term) => haystack.includes(term));
}

function pinnedRank(id: string, pinned: readonly string[] | undefined): number {
  if (!pinned) return Number.MAX_SAFE_INTEGER;
  const index = pinned.indexOf(id);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function searchApplicationEntries(
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
  query: string,
  options: Pick<ShellSearchOptions, "pinnedNative" | "pinnedElements"> = {},
): ShellSearchResult[] {
  const native = nativeApps
    .filter((app) => app.runtimeOnly !== true)
    .filter((app) => matches(normalize(`${app.name}\n${app.id}\n${app.handlerId}`), query))
    .sort((left, right) => {
      const rank = pinnedRank(left.handlerId, options.pinnedNative) - pinnedRank(right.handlerId, options.pinnedNative);
      return rank || left.name.localeCompare(right.name);
    })
    .map<NativeAppSearchResult>((app) => ({
      kind: "native-app",
      id: `native:${app.handlerId}`,
      category: "apps",
      title: app.name,
      subtitle: "Plasmon application",
      app,
    }));

  const neutron = elements
    .filter((element) => matches(normalize(`${element.name}\n${element.id}\n${element.description}\n${element.running}`), query))
    .sort((left, right) => {
      const rank = pinnedRank(left.id, options.pinnedElements) - pinnedRank(right.id, options.pinnedElements);
      return rank || left.name.localeCompare(right.name);
    })
    .map<ElementSearchResult>((element) => ({
      kind: "element",
      id: `element:${element.id}`,
      category: "apps",
      title: element.name,
      subtitle: elementSubtitle(element),
      element,
    }));

  return [...native, ...neutron];
}

export async function searchFilesystem(
  fs: FsService,
  query: string,
  options: FilesystemSearchOptions = {},
): Promise<Pick<SearchBatch, "results" | "warnings" | "truncated">> {
  const maxNodes = Math.max(1, options.maxNodes ?? 5_000);
  const maxWarnings = Math.max(0, options.maxWarnings ?? 8);
  const hasQuery = query.trim().length > 0;
  checkAbort(options.signal);

  const root = await fs.resolvePath("/");
  checkAbort(options.signal);
  if (!root) throw new Error("Filesystem root is unavailable");
  if (root.kind !== "directory") throw new Error("Filesystem root is not a directory");

  const queue: FsNode[] = [root];
  const visited = new Set<string>();
  const appShortcuts: StartShortcutSearchResult[] = [];
  const projections: NeutronProjectionSearchResult[] = [];
  const directories: DirectorySearchResult[] = [];
  const files: FileSearchResult[] = [];
  const warnings: string[] = [];
  let examined = 0;

  while (queue.length > 0 && examined < maxNodes) {
    checkAbort(options.signal);
    const directory = queue.shift();
    if (!directory || visited.has(directory.id)) continue;
    visited.add(directory.id);

    let children: FsNode[];
    try {
      children = await fs.list(directory.id, { includeHidden: false, sort: "name" });
    } catch (error: unknown) {
      if (warnings.length < maxWarnings) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Could not search ${directory.name || "/"}: ${message}`);
      }
      continue;
    }
    checkAbort(options.signal);

    for (const node of children) {
      if (examined >= maxNodes) break;
      examined += 1;
      if (node.kind === "directory") {
        if (!visited.has(node.id)) queue.push(node);
        if (hasQuery && matches(searchableNodeText(node), query)) {
          directories.push({
            kind: "directory",
            id: `directory:${node.id}`,
            category: "documents",
            title: node.name,
            subtitle: "Folder",
            node,
          });
        }
        continue;
      }

      const shortcut = parseStartShortcut(node);
      if (shortcut && matches(`${searchableNodeText(node)}\n${normalize(startShortcutTargetIdentity(shortcut.target))}`, query)) {
        appShortcuts.push({
          kind: "start-shortcut",
          id: `shortcut:${node.id}`,
          category: "apps",
          title: node.name,
          subtitle: shortcutSubtitle(shortcut.target),
          node,
          target: shortcut.target,
        });
        continue;
      }

      if (!matches(searchableNodeText(node), query)) continue;

      const classification = classifyResource(node);
      if (classification.kind === "neutron-app" && classification.neutronApp) {
        projections.push(projectionSearchResult(node, classification.neutronApp));
        continue;
      }

      const category = categorizeNonApplicationFsNode(node);
      files.push({
        kind: "file",
        id: `node:${node.id}`,
        category,
        title: node.name,
        subtitle: fileSubtitle(node, category),
        node,
      });
    }
  }

  const recent = <T extends { node: FsNode }>(left: T, right: T) =>
    right.node.modifiedAt - left.node.modifiedAt || left.node.name.localeCompare(right.node.name);
  appShortcuts.sort(recent);
  projections.sort(recent);
  directories.sort(recent);
  files.sort(recent);
  return { results: [...appShortcuts, ...projections, ...directories, ...files], warnings, truncated: queue.length > 0 };
}

function applyResultLimits(results: readonly ShellSearchResult[]): { results: ShellSearchResult[]; truncated: boolean } {
  const output: ShellSearchResult[] = [];
  let truncated = false;
  for (const category of ["apps", "documents", "media", "atoms"] as const) {
    const matchesCategory = results.filter((result) => result.category === category);
    const limit = SEARCH_CATEGORY_LIMITS[category];
    output.push(...matchesCategory.slice(0, limit));
    if (matchesCategory.length > limit) truncated = true;
  }
  if (output.length > SEARCH_TOTAL_LIMIT) {
    truncated = true;
    return { results: output.slice(0, SEARCH_TOTAL_LIMIT), truncated };
  }
  return { results: output, truncated };
}

export async function searchShell(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
  query: string,
  options: ShellSearchOptions = {},
): Promise<SearchBatch> {
  const apps = searchApplicationEntries(nativeApps, elements, query, options);
  const filesystem = await searchFilesystem(fs, query, options);
  const projections = filesystem.results.filter(
    (result): result is NeutronProjectionSearchResult => result.kind === "neutron-projection",
  );
  const projectionByElement = new Map(projections.map((projection) => [projection.elementId, projection] as const));
  const elementsById = new Map(elements.map((element) => [element.id, element] as const));
  const emittedProjectionIds = new Set<string>();

  const applicationResults = apps.map<ShellSearchResult>((result) => {
    if (result.kind !== "element") return result;
    const projection = projectionByElement.get(result.element.id);
    if (!projection) return result;
    emittedProjectionIds.add(projection.elementId);
    return withElementPresentation(projection, result.element);
  });

  for (const projection of projections) {
    if (emittedProjectionIds.has(projection.elementId)) continue;
    applicationResults.push(withElementPresentation(projection, elementsById.get(projection.elementId)));
    emittedProjectionIds.add(projection.elementId);
  }

  const nonProjectionFilesystemResults = filesystem.results.filter((result) => result.kind !== "neutron-projection");
  const limited = applyResultLimits([...applicationResults, ...nonProjectionFilesystemResults]);
  return {
    results: limited.results,
    warnings: filesystem.warnings,
    truncated: filesystem.truncated || limited.truncated,
  };
}

export function filterSearchResults(results: readonly ShellSearchResult[], tab: SearchTab): ShellSearchResult[] {
  if (tab === "all") return [...results];
  return results.filter((result) => result.category === tab);
}

/** Small Shell-owned adapter so React only observes one invalidation callback. */
export function subscribeSearchInvalidation(source: FsEventSource | undefined, invalidate: () => void): () => void {
  return source?.subscribe(() => invalidate()) ?? (() => undefined);
}

export class LatestSearchController<T> {
  private sequence = 0;
  cancel(): void { this.sequence += 1; }
  async run(task: () => Promise<T>, apply: (value: T) => void): Promise<boolean> {
    const request = ++this.sequence;
    const value = await task();
    if (request !== this.sequence) return false;
    apply(value);
    return true;
  }
}
