import type {
  CreateFileOptions,
  FsEvent,
  FsEventSource,
  FsNode,
  FsReadRange,
  FsService,
  HandlerId,
  NeutronBridge,
  NodeId,
  OpenTarget,
  ProcessCloseHandler,
  ProcessCloseRequest,
  ProcessController,
  ProcessId,
  ProcessRecord,
  Revision,
  WindowGeometry,
  WindowId,
  WindowManager,
  WindowState,
  WriteOptions,
} from "../contracts/index.ts";

const encoder = new TextEncoder();

function nextId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

export class MemoryFs implements FsService, FsEventSource {
  readonly rootId: NodeId = "root";
  private rev = 0n;
  private nodes = new Map<NodeId, FsNode>();
  private contents = new Map<NodeId, Uint8Array>();
  private listeners = new Set<(event: FsEvent) => void>();

  constructor() {
    const now = Date.now();
    this.nodes.set(this.rootId, {
      id: this.rootId,
      parentId: null,
      name: "",
      kind: "directory",
      size: 0,
      createdAt: now,
      modifiedAt: now,
      metadata: {},
    });
  }

  private emit(event: FsEvent): void {
    this.rev += 1n;
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: (event: FsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async stat(id: NodeId): Promise<FsNode> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown filesystem node: ${id}`);
    return { ...node, metadata: { ...node.metadata } };
  }

  async resolvePath(path: string): Promise<FsNode | null> {
    if (path === "/") return this.stat(this.rootId);
    const parts = path.split("/").filter(Boolean);
    let current = this.rootId;
    for (const part of parts) {
      const child = [...this.nodes.values()].find((node) => node.parentId === current && node.name === part);
      if (!child) return null;
      current = child.id;
    }
    return this.stat(current);
  }

  async pathOf(id: NodeId): Promise<string> {
    const parts: string[] = [];
    let current = await this.stat(id);
    while (current.parentId !== null) {
      parts.unshift(current.name);
      current = await this.stat(current.parentId);
    }
    return `/${parts.join("/")}`;
  }

  async list(parentId: NodeId): Promise<FsNode[]> {
    await this.stat(parentId);
    return [...this.nodes.values()]
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({ ...node, metadata: { ...node.metadata } }));
  }

  async mkdir(parentId: NodeId, name: string): Promise<FsNode> {
    return this.createNode(parentId, name, "directory");
  }

  async createFile(parentId: NodeId, name: string, options: CreateFileOptions = {}): Promise<FsNode> {
    const node = await this.createNode(parentId, name, options.kind ?? "file", options.mime, options.metadata);
    this.contents.set(node.id, new Uint8Array());
    return node;
  }

  private async createNode(
    parentId: NodeId,
    name: string,
    kind: FsNode["kind"],
    mime?: string,
    metadata: FsNode["metadata"] = {},
  ): Promise<FsNode> {
    const parent = await this.stat(parentId);
    if (parent.kind !== "directory") throw new Error("Parent is not a directory");
    if ((await this.list(parentId)).some((node) => node.name === name)) throw new Error(`Name already exists: ${name}`);
    const now = Date.now();
    const node: FsNode = {
      id: nextId("node"), parentId, name, kind, size: 0, createdAt: now, modifiedAt: now,
      ...(mime ? { mime } : {}), metadata: { ...metadata },
    };
    this.nodes.set(node.id, node);
    this.emit({ type: "created", node });
    return this.stat(node.id);
  }

  async read(id: NodeId, range?: FsReadRange): Promise<Uint8Array> {
    await this.stat(id);
    const bytes = this.contents.get(id) ?? new Uint8Array();
    return range ? bytes.slice(range.offset, range.offset + range.length) : bytes.slice();
  }

  async write(id: NodeId, bytes: Uint8Array, options: WriteOptions = {}): Promise<FsNode> {
    const node = await this.stat(id);
    if (node.kind === "directory") throw new Error("Cannot write a directory");
    const old = this.contents.get(id) ?? new Uint8Array();
    const offset = options.offset ?? 0;
    const required = offset + bytes.length;
    const length = options.truncate ? required : Math.max(old.length, required);
    const next = new Uint8Array(length);
    next.set(old.slice(0, length));
    next.set(bytes, offset);
    this.contents.set(id, next);
    const changed = { ...node, size: next.length, modifiedAt: Date.now() };
    this.nodes.set(id, changed);
    this.emit({ type: "changed", node: changed });
    return this.stat(id);
  }

  async rename(id: NodeId, newName: string): Promise<FsNode> {
    const node = await this.stat(id);
    const changed = { ...node, name: newName, modifiedAt: Date.now() };
    this.nodes.set(id, changed);
    this.emit({ type: "changed", node: changed });
    return this.stat(id);
  }

  async move(id: NodeId, newParentId: NodeId): Promise<FsNode> {
    const node = await this.stat(id);
    await this.stat(newParentId);
    if (node.parentId === null) throw new Error("Cannot move filesystem root");
    const oldParentId = node.parentId;
    const changed = { ...node, parentId: newParentId, modifiedAt: Date.now() };
    this.nodes.set(id, changed);
    this.emit({ type: "moved", node: changed, oldParentId });
    return this.stat(id);
  }

  async copy(id: NodeId, newParentId: NodeId, name?: string): Promise<FsNode> {
    const source = await this.stat(id);
    const copy = source.kind === "directory"
      ? await this.mkdir(newParentId, name ?? source.name)
      : await this.createFile(newParentId, name ?? source.name, { kind: source.kind, mime: source.mime, metadata: source.metadata });
    if (source.kind !== "directory") await this.write(copy.id, await this.read(id), { truncate: true });
    return copy;
  }

  async remove(id: NodeId, options: { recursive?: boolean } = {}): Promise<void> {
    const node = await this.stat(id);
    if (node.parentId === null) throw new Error("Cannot remove filesystem root");
    const children = await this.list(id).catch(() => []);
    if (children.length && !options.recursive) throw new Error("Directory is not empty");
    for (const child of children) await this.remove(child.id, { recursive: true });
    this.nodes.delete(id);
    this.contents.delete(id);
    this.emit({ type: "removed", id, parentId: node.parentId });
  }

  async setMetadata(id: NodeId, patch: Record<string, import("../contracts/index.ts").JsonValue | null>): Promise<FsNode> {
    const node = await this.stat(id);
    const metadata = { ...node.metadata };
    for (const [key, value] of Object.entries(patch)) value === null ? delete metadata[key] : metadata[key] = value;
    const changed = { ...node, metadata, modifiedAt: Date.now() };
    this.nodes.set(id, changed);
    this.emit({ type: "changed", node: changed });
    return this.stat(id);
  }

  async revision(): Promise<Revision> { return this.rev; }
}

export class MemoryWindowManager implements WindowManager {
  private windows: WindowState[] = [];
  private listeners = new Set<() => void>();
  private emit(): void { for (const listener of this.listeners) listener(); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  create(processId: ProcessId, initial: Partial<WindowGeometry>): WindowId {
    const id = nextId("window");
    this.windows.push({ id, processId, x: initial.x ?? 80, y: initial.y ?? 60, width: initial.width ?? 720, height: initial.height ?? 520, z: this.windows.length + 1, minimized: false, maximized: false });
    this.emit(); return id;
  }
  focus(id: WindowId): void { const item = this.windows.find((window) => window.id === id); if (item) item.z = Math.max(0, ...this.windows.map((window) => window.z)) + 1; this.emit(); }
  move(id: WindowId, x: number, y: number): void { const item = this.windows.find((window) => window.id === id); if (item) Object.assign(item, { x, y }); this.emit(); }
  resize(id: WindowId, width: number, height: number): void { const item = this.windows.find((window) => window.id === id); if (item) Object.assign(item, { width, height }); this.emit(); }
  minimize(id: WindowId): void { const item = this.windows.find((window) => window.id === id); if (item) item.minimized = true; this.emit(); }
  maximize(id: WindowId): void { const item = this.windows.find((window) => window.id === id); if (item) item.maximized = true; this.emit(); }
  restore(id: WindowId): void { const item = this.windows.find((window) => window.id === id); if (item) Object.assign(item, { minimized: false, maximized: false }); this.emit(); }
  close(id: WindowId): void { this.windows = this.windows.filter((window) => window.id !== id); this.emit(); }
  list(): readonly WindowState[] { return this.windows.map((window) => ({ ...window })); }
}

export class MemoryProcessController implements ProcessController {
  private records: ProcessRecord[] = [];
  private listeners = new Set<() => void>();
  private closeHandlers = new Map<ProcessId, ProcessCloseHandler>();
  private pendingCloses = new Map<ProcessId, symbol>();
  constructor(private windows: WindowManager) {}
  private emit(): void { for (const listener of this.listeners) listener(); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async open(handlerId: HandlerId, target: OpenTarget): Promise<ProcessId> {
    const id = nextId("process");
    const windowId = this.windows.create(id, {});
    this.records.push({ id, appId: handlerId, handlerId, target, title: handlerId, icon: "", state: "running", windowId });
    this.emit(); return id;
  }
  focus(id: ProcessId): void { const record = this.records.find((item) => item.id === id); if (record?.windowId) this.windows.focus(record.windowId); }
  close(id: ProcessId): boolean {
    const record = this.records.find((item) => item.id === id);
    if (!record) return true;
    if (this.pendingCloses.has(id)) return false;
    const handler = this.closeHandlers.get(id);
    if (!handler) return this.forceClose(id);

    const token = Symbol(`process-close:${id}`);
    this.pendingCloses.set(id, token);
    const request: ProcessCloseRequest = {
      processId: id,
      complete: () => {
        if (this.pendingCloses.get(id) !== token) return;
        this.pendingCloses.delete(id);
        this.forceClose(id);
      },
      cancel: () => {
        if (this.pendingCloses.get(id) === token) this.pendingCloses.delete(id);
      },
    };

    let decision: ReturnType<ProcessCloseHandler>;
    try {
      decision = handler(request);
    } catch {
      this.pendingCloses.delete(id);
      return false;
    }
    if (this.pendingCloses.get(id) !== token) return !this.records.some((item) => item.id === id);
    if (decision === "allow") {
      this.pendingCloses.delete(id);
      return this.forceClose(id);
    }
    if (decision === "prevent") this.pendingCloses.delete(id);
    return false;
  }
  forceClose(id: ProcessId): boolean {
    const record = this.records.find((item) => item.id === id);
    this.pendingCloses.delete(id);
    this.closeHandlers.delete(id);
    if (!record) return true;
    if (record.windowId) this.windows.close(record.windowId);
    this.records = this.records.filter((item) => item.id !== id);
    this.emit();
    return true;
  }
  registerCloseHandler(id: ProcessId, handler: ProcessCloseHandler): () => void {
    if (!this.records.some((item) => item.id === id)) throw new Error(`Unknown process: ${id}`);
    if (this.closeHandlers.has(id)) throw new Error(`Close handler already registered for process: ${id}`);
    this.closeHandlers.set(id, handler);
    return () => {
      if (this.closeHandlers.get(id) !== handler) return;
      this.closeHandlers.delete(id);
      this.pendingCloses.delete(id);
    };
  }
  setTitle(id: ProcessId, title: string): void { const record = this.records.find((item) => item.id === id); if (record) record.title = title; this.emit(); }
  setTarget(id: ProcessId, target: OpenTarget): void { const record = this.records.find((item) => item.id === id); if (record) record.target = target; this.emit(); }
  list(): readonly ProcessRecord[] { return this.records.map((record) => ({ ...record })); }
}

export class EmptyNeutronBridge implements NeutronBridge {
  async loadElements() { return []; }
  async openElement(): Promise<void> {}
  async offerInstall(): Promise<void> {}
  async refreshRuntimeState(): Promise<void> {}
  subscribe(): () => void { return () => {}; }
}

export const fakeText = (value: string): Uint8Array => encoder.encode(value);
