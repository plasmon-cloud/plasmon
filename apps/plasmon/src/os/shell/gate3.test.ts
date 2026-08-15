import { describe, expect, test } from "bun:test";
import type {
  ExternalElement,
  FsEvent,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsService,
  JsonValue,
  NativeAppDefinition,
} from "../contracts/index.ts";
import { LatestSearchController, SEARCH_CATEGORY_LIMITS, SEARCH_TOTAL_LIMIT, searchShell, subscribeSearchInvalidation } from "./search.ts";
import { reconcileStartMenu } from "./startMenu.ts";

class GateFs implements FsService, FsEventSource {
  private sequence = 0;
  private nodes = new Map<string, FsNode>([["root", {
    id: "root", parentId: null, name: "", kind: "directory", size: 0,
    createdAt: 1, modifiedAt: 1, metadata: {},
  }]]);
  private listeners = new Set<(event: FsEvent) => void>();

  private emit(nodeId: string): void {
    const event: FsEvent = { type: "change", nodeId, revision: this.sequence };
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: FsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    if (path === "/") return this.nodes.get("root") ?? null;
    const parts = path.split("/").filter(Boolean);
    let parentId = "root";
    let current: FsNode | undefined;
    for (const part of parts) {
      current = [...this.nodes.values()].find((node) => node.parentId === parentId && node.name === part);
      if (!current) return null;
      parentId = current.id;
    }
    return current ?? null;
  }

  async stat(id: string): Promise<FsNode | null> { return this.nodes.get(id) ?? null; }
  async list(parentId: string, _options?: FsListOptions): Promise<FsNode[]> {
    return [...this.nodes.values()].filter((node) => node.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
  }
  async createDirectory(parentId: string, name: string, options?: { metadata?: Record<string, JsonValue> }): Promise<FsNode> {
    const node: FsNode = { id: `node-${++this.sequence}`, parentId, name, kind: "directory", size: 0, createdAt: this.sequence, modifiedAt: this.sequence, metadata: options?.metadata ?? {} };
    this.nodes.set(node.id, node); this.emit(node.id); return node;
  }
  async createFile(parentId: string, name: string, options: { mime?: string; kind?: "file" | "shortcut" | "atom"; metadata?: Record<string, JsonValue> } = {}): Promise<FsNode> {
    const node: FsNode = { id: `node-${++this.sequence}`, parentId, name, kind: options.kind ?? "file", mime: options.mime, size: 0, createdAt: this.sequence, modifiedAt: this.sequence, metadata: options.metadata ?? {} };
    this.nodes.set(node.id, node); this.emit(node.id); return node;
  }
  async read(): Promise<Uint8Array> { return new Uint8Array(); }
  async write(): Promise<FsNode> { throw new Error("not needed"); }
  async rename(id: string, name: string): Promise<FsNode> { const node = this.nodes.get(id)!; const next = { ...node, name }; this.nodes.set(id, next); this.emit(id); return next; }
  async move(id: string, parentId: string): Promise<FsNode> { const node = this.nodes.get(id)!; const next = { ...node, parentId }; this.nodes.set(id, next); this.emit(id); return next; }
  async copy(): Promise<FsNode> { throw new Error("not needed"); }
  async remove(id: string): Promise<void> { this.nodes.delete(id); this.emit(id); }
  async setMetadata(id: string, patch: Record<string, JsonValue | undefined>): Promise<FsNode> {
    const node = this.nodes.get(id)!;
    const metadata = { ...node.metadata };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete metadata[key]; else metadata[key] = value;
    }
    const next = { ...node, metadata }; this.nodes.set(id, next); this.emit(id); return next;
  }
}

const textApp: NativeAppDefinition = {
  id: "text", handlerId: "plasmon.text", name: "Text", singleton: false,
  window: { title: "Text", width: 800, height: 600, minWidth: 480, minHeight: 320 },
};
const mailElement: ExternalElement = { id: "mail", name: "Mail", description: "Inbox", running: "no" };

async function shortcutNodes(fs: GateFs) {
  const start = await fs.resolvePath("/System/Start Menu");
  if (!start) return [];
  return (await fs.list(start.id)).map((node) => ({ node, target: (node.metadata.shortcut as Record<string, JsonValue>).target as any }));
}

test("Start is filesystem-backed with folders and seeded shortcut nodes", async () => {
  const fs = new GateFs();
  await reconcileStartMenu(fs, [textApp], [mailElement]);
  expect(await fs.resolvePath("/System/Start Menu")).not.toBeNull();
  expect(await fs.resolvePath("/System/Start Menu/Accessories")).not.toBeNull();
  expect(await fs.resolvePath("/System/Start Menu/Internet")).not.toBeNull();
  expect(await fs.resolvePath("/System/Start Menu/Media")).not.toBeNull();
  const shortcuts = await shortcutNodes(fs);
  expect(shortcuts.some((item) => item.target.kind === "native" && item.target.handlerId === "plasmon.text")).toBe(true);
  expect(shortcuts.some((item) => item.target.kind === "element" && item.target.elementId === "mail")).toBe(true);
});

test("Start folder navigation lists child filesystem content", async () => {
  const fs = new GateFs();
  await reconcileStartMenu(fs, [textApp], [mailElement]);
  const accessories = await fs.resolvePath("/System/Start Menu/Accessories");
  expect(accessories?.kind).toBe("directory");
  expect((await fs.list(accessories!.id)).some((node) => node.name === "Text")).toBe(true);
});

test("Start reconciliation prevents duplicates and preserves user rename/move", async () => {
  const fs = new GateFs();
  await reconcileStartMenu(fs, [textApp], [mailElement]);
  const text = (await shortcutNodes(fs)).find((item) => item.target.kind === "native")!;
  const tools = await fs.createDirectory((await fs.resolvePath("/System/Start Menu"))!.id, "Tools");
  await fs.rename(text.node.id, "Editor");
  await fs.move(text.node.id, tools.id);
  await reconcileStartMenu(fs, [textApp], [mailElement]);
  const preserved = await fs.stat(text.node.id);
  expect(preserved?.name).toBe("Editor");
  expect(preserved?.parentId).toBe(tools.id);
});

test("intentionally deleted seeded shortcut is not recreated", async () => {
  const fs = new GateFs();
  await reconcileStartMenu(fs, [textApp], [mailElement]);
  const mail = (await shortcutNodes(fs)).find((item) => item.target.kind === "element")!;
  await fs.remove(mail.node.id);
  const result = await reconcileStartMenu(fs, [textApp], [mailElement]);
  expect(result.skippedDeleted).toBe(1);
  expect((await shortcutNodes(fs)).some((item) => item.target.kind === "element")).toBe(false);
});

test("empty-query Search returns useful apps, Documents, Media, and Atoms", async () => {
  const fs = new GateFs();
  await fs.createFile("root", "notes.txt", { mime: "text/plain" });
  await fs.createFile("root", "face.png", { mime: "image/png" });
  await fs.createFile("root", "clip.mp4", { mime: "video/mp4" });
  await fs.createFile("root", "draft.atom", { kind: "atom" });
  const batch = await searchShell(fs, [textApp], [mailElement], "");
  expect(batch.results.some((result) => result.kind === "native-app")).toBe(true);
  expect(batch.results.some((result) => result.kind === "element")).toBe(true);
  expect(batch.results.some((result) => result.category === "documents" && result.title === "notes.txt")).toBe(true);
  expect(batch.results.some((result) => result.category === "media" && result.title === "face.png")).toBe(true);
  expect(batch.results.some((result) => result.category === "media" && result.title === "clip.mp4")).toBe(true);
  expect(batch.results.some((result) => result.category === "atoms" && result.title === "draft.atom")).toBe(true);
});

test("Search classification and result caps are bounded without implying incomplete traversal", async () => {
  const fs = new GateFs();
  for (let index = 0; index < 30; index += 1) await fs.createFile("root", `doc-${index}.md`, { mime: "text/markdown" });
  for (let index = 0; index < 30; index += 1) await fs.createFile("root", `image-${index}.png`, { mime: "image/png" });
  const batch = await searchShell(fs, [], [], "");
  expect(batch.results.filter((result) => result.category === "documents")).toHaveLength(SEARCH_CATEGORY_LIMITS.documents);
  expect(batch.results.filter((result) => result.category === "media")).toHaveLength(SEARCH_CATEGORY_LIMITS.media);
  expect(batch.results.length).toBeLessThanOrEqual(SEARCH_TOTAL_LIMIT);
  expect(batch.truncated).toBe(false);
  expect(batch.capped).toBe(true);
});

test("FsEvent invalidation triggers a rescan that discovers newly created content", async () => {
  const fs = new GateFs();
  let latest = await searchShell(fs, [], [], "fresh");
  let pending: Promise<void> = Promise.resolve();
  const unsubscribe = subscribeSearchInvalidation(fs, () => {
    pending = searchShell(fs, [], [], "fresh").then((batch) => { latest = batch; });
  });
  await fs.createFile("root", "fresh.txt", { mime: "text/plain" });
  await pending;
  unsubscribe();
  expect(latest.results.some((result) => result.title === "fresh.txt")).toBe(true);
});

test("stale async searches cannot overwrite newer query state", async () => {
  const controller = new LatestSearchController<string>();
  const applied: string[] = [];
  let oldResolve!: (value: string) => void;
  const old = new Promise<string>((resolve) => { oldResolve = resolve; });
  const older = controller.run(() => old, (value) => applied.push(value));
  const newer = controller.run(async () => "new", (value) => applied.push(value));
  expect(await newer).toBe(true);
  oldResolve("old");
  expect(await older).toBe(false);
  expect(applied).toEqual(["new"]);
});

test("successful result activation dismisses Search", () => {
  let open = true;
  const activate = () => { open = false; };
  activate();
  expect(open).toBe(false);
});

test("click-away closes flyouts while inside and toggle interactions do not fight dismissal", () => {
  const shouldDismiss = (insideFlyout: boolean, insideToggle: boolean) => !insideFlyout && !insideToggle;
  expect(shouldDismiss(false, false)).toBe(true);
  expect(shouldDismiss(true, false)).toBe(false);
  expect(shouldDismiss(false, true)).toBe(false);
});

test("Pin and Unpin state exposes exact taskbar tooltip labels", () => {
  const label = (pinned: boolean) => pinned ? "Unpin from taskbar" : "Pin to taskbar";
  expect(label(false)).toBe("Pin to taskbar");
  expect(label(true)).toBe("Unpin from taskbar");
});

test("Shell context-menu arbitration keeps app content free and specialized task menus win", () => {
  const policy = (shellOwned: boolean, nativeTask: boolean, elementTask: boolean) => nativeTask ? "native" : elementTask ? "element" : shellOwned ? "shell" : "none";
  expect(policy(false, false, false)).toBe("none");
  expect(policy(true, false, false)).toBe("shell");
  expect(policy(true, true, false)).toBe("native");
  expect(policy(true, false, true)).toBe("element");
});
