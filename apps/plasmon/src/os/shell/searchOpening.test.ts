// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type {
  CreateFileOptions,
  FsListOptions,
  FsNode,
  FsReadRange,
  FsService,
  HandlerDefinition,
  OpenService,
  OpenTarget,
  Revision,
  WriteOptions,
} from "../contracts/index.ts";
import {
  createAtomPackage,
  HandlerAssociationRegistry,
} from "../associations/index.ts";
import {
  openFilesystemSearchResult,
  SEARCH_ASSOCIATION_PROBE_BYTES,
  SearchResultInspectionError,
} from "./searchOpening.ts";

const encoder = new TextEncoder();

function node(patch: Partial<FsNode> = {}): FsNode {
  return {
    id: "node:search",
    parentId: "root",
    name: "result.txt",
    kind: "file",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
    ...patch,
  };
}

class SingleNodeFs implements FsService {
  readonly reads: FsReadRange[] = [];

  constructor(
    readonly current: FsNode,
    readonly bytes: Uint8Array = new Uint8Array(),
  ) {}

  async stat(id: string): Promise<FsNode> {
    if (id !== this.current.id) throw new Error(`Unknown node ${id}`);
    return { ...this.current, metadata: { ...this.current.metadata } };
  }

  async resolvePath(): Promise<FsNode | null> { return null; }
  async pathOf(): Promise<string> { return `/${this.current.name}`; }
  async list(_parentId: string, _options?: FsListOptions): Promise<FsNode[]> { return []; }
  async mkdir(): Promise<FsNode> { throw new Error("unused"); }
  async createFile(_parentId: string, _name: string, _options?: CreateFileOptions): Promise<FsNode> { throw new Error("unused"); }

  async read(id: string, range?: FsReadRange): Promise<Uint8Array> {
    if (id !== this.current.id) throw new Error(`Unknown node ${id}`);
    const selected = range ?? { offset: 0, length: this.bytes.length };
    this.reads.push({ ...selected });
    return this.bytes.slice(selected.offset, selected.offset + selected.length);
  }

  async write(_id: string, _bytes: Uint8Array, _options?: WriteOptions): Promise<FsNode> { throw new Error("unused"); }
  async rename(): Promise<FsNode> { throw new Error("unused"); }
  async move(): Promise<FsNode> { throw new Error("unused"); }
  async copy(): Promise<FsNode> { throw new Error("unused"); }
  async remove(): Promise<void> { throw new Error("unused"); }
  async setMetadata(): Promise<FsNode> { throw new Error("unused"); }
  async revision(): Promise<Revision> { return 0n; }
}

function handler(id: string, name = id): HandlerDefinition {
  return { id, kind: "native", name, icon: id, capabilities: ["read"] };
}

function captureOpenService() {
  const calls: Array<{ handlerId: string; target: OpenTarget }> = [];
  const service: OpenService = {
    async open(handlerId, target) {
      calls.push({ handlerId, target });
    },
  };
  return { service, calls };
}

function urlRegistry(): HandlerAssociationRegistry {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:video", "Video"));
  registry.registerHandler(handler("native:browser", "Browser"));
  registry.registerRule({
    id: "url-browser-fallback",
    handlerId: "native:browser",
    extensions: [".url"],
    priority: 100,
  });
  return registry;
}

test("search .url explicit Handler=native:video overrides the ordinary .url association", async () => {
  const bytes = encoder.encode("[InternetShortcut]\r\nURL=https://youtu.be/demo\r\nHandler=native:video\r\n");
  const fs = new SingleNodeFs(node({ name: "demo.url", kind: "shortcut", size: bytes.length }), bytes);
  const registry = urlRegistry();
  const opened = captureOpenService();

  await openFilesystemSearchResult(fs, registry, opened.service, fs.current.id);

  expect(opened.calls).toHaveLength(1);
  expect(opened.calls[0]?.handlerId).toBe("native:video");
});

test("search .url preserves the parsed target URL in OpenTarget", async () => {
  const bytes = encoder.encode("[InternetShortcut]\nURL=https://youtu.be/probe-target\nHandler=native:video\n");
  const fs = new SingleNodeFs(node({ name: "watch.url", kind: "shortcut", size: bytes.length }), bytes);
  const opened = captureOpenService();

  await openFilesystemSearchResult(fs, urlRegistry(), opened.service, fs.current.id);

  expect(opened.calls[0]?.target).toEqual({
    nodeId: fs.current.id,
    url: "https://youtu.be/probe-target",
  });
});

test("probe-derived Atom descriptor reaches OpenService", async () => {
  const descriptor = {
    format: "plasmon.atom" as const,
    version: 1 as const,
    atomId: "atom:probe",
    handlerId: "native:atom-viewer",
    atomType: "notepad2/v1",
    schemaVersion: 1,
    title: "Probe Atom",
  };
  const bytes = createAtomPackage({ descriptor, payload: encoder.encode("payload") });
  const fs = new SingleNodeFs(node({ name: "probe.atom", kind: "atom", size: bytes.length }), bytes);
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:atom-viewer", "Atom Viewer"));
  const opened = captureOpenService();

  await openFilesystemSearchResult(fs, registry, opened.service, fs.current.id);

  expect(opened.calls[0]?.handlerId).toBe("native:atom-viewer");
  expect(opened.calls[0]?.target.nodeId).toBe(fs.current.id);
  expect(opened.calls[0]?.target.atom).toEqual(descriptor);
});

test("ordinary search file still uses normal association resolution without reading content", async () => {
  const fs = new SingleNodeFs(node({ name: "notes.txt", mime: "text/plain", size: 5 }), encoder.encode("hello"));
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:text", "Text"));
  registry.registerRule({ id: "txt", handlerId: "native:text", extensions: [".txt"], priority: 100 });
  const opened = captureOpenService();

  await openFilesystemSearchResult(fs, registry, opened.service, fs.current.id);

  expect(fs.reads).toEqual([]);
  expect(opened.calls).toEqual([{
    handlerId: "native:text",
    target: { nodeId: fs.current.id },
  }]);
});

test("malformed probed shortcut fails safely instead of falling back to .url association", async () => {
  const bytes = encoder.encode("[InternetShortcut]\nHandler=native:video\n");
  const fs = new SingleNodeFs(node({ name: "broken.url", kind: "shortcut", size: bytes.length }), bytes);
  const opened = captureOpenService();

  let caught: unknown;
  try {
    await openFilesystemSearchResult(fs, urlRegistry(), opened.service, fs.current.id);
  } catch (cause: unknown) {
    caught = cause;
  }

  expect(caught).toBeInstanceOf(SearchResultInspectionError);
  expect(caught instanceof Error ? caught.message : "").toContain("InternetShortcut URL is required");
  expect(opened.calls).toEqual([]);
});

test("search association probes are bounded to 256 KiB", async () => {
  const bytes = encoder.encode("[InternetShortcut]\nURL=https://example.test/\nHandler=native:video\n");
  const fs = new SingleNodeFs(node({
    name: "large.url",
    kind: "shortcut",
    size: SEARCH_ASSOCIATION_PROBE_BYTES * 8,
  }), bytes);
  const opened = captureOpenService();

  await openFilesystemSearchResult(fs, urlRegistry(), opened.service, fs.current.id);

  expect(fs.reads).toEqual([{ offset: 0, length: SEARCH_ASSOCIATION_PROBE_BYTES }]);
  expect(opened.calls[0]?.handlerId).toBe("native:video");
});

test("search opening keeps handler selection registry-authoritative rather than extension-specific", async () => {
  const arbitraryHandlerId = "custom:any-handler";
  const bytes = encoder.encode(`[InternetShortcut]\nURL=https://example.test/custom\nHandler=${arbitraryHandlerId}\n`);
  const fs = new SingleNodeFs(node({ name: "custom.url", kind: "shortcut", size: bytes.length }), bytes);
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler(arbitraryHandlerId, "Arbitrary Handler"));
  registry.registerHandler(handler("fallback:url", "Fallback"));
  registry.registerRule({ id: "fallback", handlerId: "fallback:url", extensions: [".url"], priority: 9999 });
  const opened = captureOpenService();

  await openFilesystemSearchResult(fs, registry, opened.service, fs.current.id);

  expect(opened.calls[0]?.handlerId).toBe(arbitraryHandlerId);
  expect(opened.calls[0]?.target.url).toBe("https://example.test/custom");
});
