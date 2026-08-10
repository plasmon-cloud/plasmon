import type {
  ExternalElement,
  FsNode,
  FsService,
  JsonValue,
  NativeAppDefinition,
} from "../contracts/index.ts";

export type SearchTab = "all" | "apps" | "documents" | "media" | "atoms";
export type FileSearchCategory = Exclude<SearchTab, "all" | "apps">;

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

export interface FileSearchResult {
  kind: "file";
  id: string;
  category: FileSearchCategory;
  title: string;
  subtitle: string;
  node: FsNode;
}

export type ShellSearchResult = NativeAppSearchResult | ElementSearchResult | FileSearchResult;

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
  ".aac", ".avi", ".flac", ".gif", ".jpeg", ".jpg", ".m4a", ".m4v", ".mkv",
  ".mov", ".mp3", ".mp4", ".ogg", ".opus", ".png", ".svg", ".wav", ".webm", ".webp",
]);

function atomRecord(node: FsNode): Record<string, JsonValue> | null {
  const value = node.metadata.atom;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

export function categorizeFsNode(node: FsNode): FileSearchCategory {
  const atom = atomRecord(node);
  if (node.kind === "atom" || atom?.format === "plasmon.atom" || extension(node.name) === ".atom") {
    return "atoms";
  }
  if (node.mime?.startsWith("audio/") || node.mime?.startsWith("image/") || node.mime?.startsWith("video/") || MEDIA_EXTENSIONS.has(extension(node.name))) {
    return "media";
  }
  return "documents";
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
  if (node.kind === "directory") return "Folder";
  if (node.mime) return node.mime;
  return category === "media" ? "Media" : "Document";
}

function matches(haystack: string, needle: string): boolean {
  const terms = normalize(needle).trim().split(/\s+/u).filter(Boolean);
  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

export function searchApplicationEntries(
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
  query: string,
): ShellSearchResult[] {
  if (!query.trim()) return [];
  const results: ShellSearchResult[] = [];
  for (const app of nativeApps) {
    if (!matches(normalize(`${app.name}\n${app.id}\n${app.handlerId}`), query)) continue;
    results.push({
      kind: "native-app",
      id: `native:${app.handlerId}`,
      category: "apps",
      title: app.name,
      subtitle: "Plasmon application",
      app,
    });
  }
  for (const element of elements) {
    if (!matches(normalize(`${element.name}\n${element.id}\n${element.description}`), query)) continue;
    results.push({
      kind: "element",
      id: `element:${element.id}`,
      category: "apps",
      title: element.name,
      subtitle: element.description || "Neutron Element",
      element,
    });
  }
  return results;
}

export async function searchFilesystem(
  fs: FsService,
  query: string,
  options: FilesystemSearchOptions = {},
): Promise<Pick<SearchBatch, "results" | "warnings" | "truncated">> {
  if (!query.trim()) return { results: [], warnings: [], truncated: false };
  const maxNodes = Math.max(1, options.maxNodes ?? 5_000);
  const maxWarnings = Math.max(0, options.maxWarnings ?? 8);
  checkAbort(options.signal);

  const root = await fs.resolvePath("/");
  checkAbort(options.signal);
  if (!root) throw new Error("Filesystem root is unavailable");
  if (root.kind !== "directory") throw new Error("Filesystem root is not a directory");

  const queue: FsNode[] = [root];
  const visited = new Set<string>();
  const results: ShellSearchResult[] = [];
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
      if (node.kind === "directory" && !visited.has(node.id)) queue.push(node);
      if (!matches(searchableNodeText(node), query)) continue;
      const category = categorizeFsNode(node);
      results.push({
        kind: "file",
        id: `node:${node.id}`,
        category,
        title: node.name,
        subtitle: fileSubtitle(node, category),
        node,
      });
    }
  }

  return { results, warnings, truncated: queue.length > 0 };
}

export async function searchShell(
  fs: FsService,
  nativeApps: readonly NativeAppDefinition[],
  elements: readonly ExternalElement[],
  query: string,
  options: FilesystemSearchOptions = {},
): Promise<SearchBatch> {
  const apps = searchApplicationEntries(nativeApps, elements, query);
  const files = await searchFilesystem(fs, query, options);
  return { results: [...apps, ...files.results], warnings: files.warnings, truncated: files.truncated };
}

export function filterSearchResults(results: readonly ShellSearchResult[], tab: SearchTab): ShellSearchResult[] {
  if (tab === "all") return [...results];
  return results.filter((result) => result.category === tab);
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
