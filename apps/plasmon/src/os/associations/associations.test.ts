import { expect, test } from "bun:test";
import type { AtomDescriptor, FsNode, HandlerDefinition, OpenTarget } from "../contracts/index.ts";
import {
  HandlerAssociationRegistry,
  MemoryAssociationDefaultStore,
  OpenWithServiceModel,
  associationTypeKey,
  atomMetadata,
  createAtomPackage,
  parseAtomDescriptor,
  serializeAtomDescriptor,
  tryGetAtomDescriptorFromNode,
  tryParseAtomPackage,
  tryParseInternetShortcut,
  updateAtomDescriptor,
  writeInternetShortcut,
} from "./index.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function handler(id: string, name = id): HandlerDefinition {
  return { id, kind: "native", name, icon: "system:test", capabilities: ["read"] };
}

function node(patch: Partial<FsNode> = {}): FsNode {
  return {
    id: "node:1",
    parentId: "root",
    name: "README.md",
    kind: "file",
    mime: "text/markdown",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
    ...patch,
  };
}

const atom: AtomDescriptor = {
  format: "plasmon.atom",
  version: 1,
  atomId: "atom:c553",
  handlerId: "neutron:spreadsheet",
  atomType: "spreadsheet/v1",
  schemaVersion: 1,
  title: "Budget",
  metadata: { ownerHint: "local" },
};

test("extension resolution is case-insensitive and priority ordered", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:text"));
  registry.registerHandler(handler("native:markdown"));
  registry.registerRule({ id: "text-md", handlerId: "native:text", extensions: ["md"], priority: 10 });
  registry.registerRule({ id: "markdown-md", handlerId: "native:markdown", extensions: [".MD"], priority: 20 });

  expect((await registry.resolve(node({ name: "Notes.MD" }))).map(({ id }) => id)).toEqual([
    "native:markdown",
    "native:text",
  ]);
});

test("compound extensions outrank ordinary extensions", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:atom"));
  registry.registerHandler(handler("neutron:spreadsheet"));
  registry.registerRule({ id: "generic-atom", handlerId: "native:atom", extensions: [".atom"], priority: 1000 });
  registry.registerRule({ id: "spreadsheet-atom", handlerId: "neutron:spreadsheet", extensions: [".spreadsheet.atom"], priority: 1 });

  expect((await registry.resolve(node({ name: "Budget.spreadsheet.atom", kind: "atom", mime: "application/octet-stream" }))).map(({ id }) => id)).toEqual([
    "neutron:spreadsheet",
    "native:atom",
  ]);
});

test("exact MIME matches outrank wildcard MIME matches", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:generic-text"));
  registry.registerHandler(handler("native:markdown"));
  registry.registerRule({ id: "generic-text", handlerId: "native:generic-text", mimeTypes: ["text/*"], priority: 100 });
  registry.registerRule({ id: "exact-markdown", handlerId: "native:markdown", mimeTypes: ["text/markdown"], priority: 1 });

  expect((await registry.resolve(node({ name: "README", mime: "text/markdown; charset=utf-8" }))).map(({ id }) => id)).toEqual([
    "native:markdown",
    "native:generic-text",
  ]);
});

test("Atom descriptor handler and Atom type precede extension rules", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("neutron:spreadsheet"));
  registry.registerHandler(handler("native:alternate-sheet"));
  registry.registerHandler(handler("native:atom"));
  registry.registerRule({ id: "atom-type", handlerId: "native:alternate-sheet", atomTypes: ["spreadsheet/v1"], priority: 50 });
  registry.registerRule({ id: "atom-extension", handlerId: "native:atom", extensions: [".atom"], priority: 999 });

  const resource = node({
    name: "Renamed.atom",
    kind: "atom",
    metadata: { atom: atomMetadata(atom) },
    mime: "application/octet-stream",
  });
  expect((await registry.resolve(resource)).map(({ id }) => id)).toEqual([
    "neutron:spreadsheet",
    "native:alternate-sheet",
    "native:atom",
  ]);
});

test("explicit node opensWith metadata is the strongest override", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:text"));
  registry.registerHandler(handler("native:markdown"));
  registry.registerRule({ id: "markdown", handlerId: "native:markdown", extensions: [".md"], priority: 100 });
  registry.registerRule({ id: "text", handlerId: "native:text", extensions: [".md"], priority: 1 });

  expect((await registry.resolve(node({ metadata: { opensWith: "native:text" } }))).map(({ id }) => id)).toEqual([
    "native:text",
    "native:markdown",
  ]);
});

test("user defaults persist through the configured store and override built-in priority", async () => {
  const defaults = new MemoryAssociationDefaultStore();
  const first = new HandlerAssociationRegistry({ defaults });
  for (const id of ["native:text", "native:markdown"]) first.registerHandler(handler(id));
  first.registerRule({ id: "markdown", handlerId: "native:markdown", extensions: [".md"], priority: 100 });
  first.registerRule({ id: "text", handlerId: "native:text", extensions: [".md"], priority: 1 });
  await first.setUserDefault(associationTypeKey.extension(".md"), "native:text");

  const second = new HandlerAssociationRegistry({ defaults });
  for (const id of ["native:text", "native:markdown"]) second.registerHandler(handler(id));
  second.registerRule({ id: "markdown", handlerId: "native:markdown", extensions: [".md"], priority: 100 });
  second.registerRule({ id: "text", handlerId: "native:text", extensions: [".md"], priority: 1 });
  expect((await second.resolve(node())).map(({ id }) => id)).toEqual(["native:text", "native:markdown"]);
});

test("equal-priority resolution is deterministic by rule id then handler id", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("handler:z"));
  registry.registerHandler(handler("handler:a"));
  registry.registerRule({ id: "z-rule", handlerId: "handler:a", extensions: [".md"], priority: 1 });
  registry.registerRule({ id: "a-rule", handlerId: "handler:z", extensions: [".md"], priority: 1 });

  expect((await registry.resolve(node())).map(({ id }) => id)).toEqual(["handler:z", "handler:a"]);
});

test("malformed association rules fail registration", () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:text"));
  expect(() => registry.registerRule({ id: "empty", handlerId: "native:text", priority: 0 })).toThrow("matcher");
  expect(() => registry.registerRule({ id: "bad-ext", handlerId: "native:text", extensions: ["*.txt"], priority: 0 })).toThrow("Malformed extension");
  expect(() => registry.registerRule({ id: "dangling", handlerId: "missing", extensions: [".txt"], priority: 0 })).toThrow("unknown handler");
});

test("Atom descriptor serialization round trips without changing identity", () => {
  const roundTrip = parseAtomDescriptor(serializeAtomDescriptor(atom));
  expect(roundTrip).toEqual(atom);
  expect(updateAtomDescriptor(atom, { title: "Budget 2027", handlerId: "neutron:spreadsheet-v2" }).atomId).toBe(atom.atomId);
});

test("renaming or moving an Atom filesystem resource does not change atomId", () => {
  const original = node({ name: "Budget.spreadsheet.atom", kind: "atom", parentId: "Documents", metadata: { atom: atomMetadata(atom) } });
  const renamedAndMoved = { ...original, name: "Retirement.spreadsheet.atom", parentId: "Archive" };
  const before = tryGetAtomDescriptorFromNode(original);
  const after = tryGetAtomDescriptorFromNode(renamedAndMoved);
  expect(before?.ok && before.descriptor.atomId).toBe(atom.atomId);
  expect(after?.ok && after.descriptor.atomId).toBe(atom.atomId);
});

test("ZIP-compatible Atom package round trips descriptor and payload", async () => {
  const bytes = createAtomPackage({
    descriptor: atom,
    payload: encoder.encode("sheet payload"),
    payloadEntry: "payload/data.bin",
    mediaType: "application/octet-stream",
    handler: { appId: "spreadsheet", minVersion: 100, packageUrl: null },
    files: { "payload/preview.txt": encoder.encode("preview") },
  });
  const parsed = await tryParseAtomPackage(bytes);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.package.descriptor).toEqual(atom);
  expect(parsed.package.handler).toEqual({ id: "neutron:spreadsheet", appId: "spreadsheet", minVersion: 100, packageUrl: null });
  expect(decoder.decode(parsed.package.payload)).toBe("sheet payload");
  expect(decoder.decode(parsed.package.files.get("payload/preview.txt"))).toBe("preview");
});

test("malformed Atom packages return structured errors instead of throwing", async () => {
  const parsed = await tryParseAtomPackage(encoder.encode("not a zip"));
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.code).toBe("not_zip");
});

test(".url writer and parser preserve Windows/daedalOS fields", () => {
  const text = writeInternetShortcut({
    url: "https://youtu.be/djCqHH0SCmA",
    baseUrl: "VideoPlayer",
    handlerId: "native:video",
    comment: "Demo video",
    iconFile: "/System/Icons/vlc.webp",
  });
  const parsed = tryParseInternetShortcut(text);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.shortcut).toEqual({
    url: "https://youtu.be/djCqHH0SCmA",
    baseUrl: "VideoPlayer",
    handlerId: "native:video",
    comment: "Demo video",
    iconFile: "/System/Icons/vlc.webp",
  });
});

test("malformed .url resources report missing URL", () => {
  const parsed = tryParseInternetShortcut("[InternetShortcut]\r\nComment=broken\r\n");
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.code).toBe("missing_url");
});

test("shortcut handler field participates in resolution before .url rules", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:video"));
  registry.registerHandler(handler("native:browser"));
  registry.registerRule({ id: "url-browser", handlerId: "native:browser", extensions: [".url"], priority: 100 });
  const shortcut = encoder.encode(writeInternetShortcut({ url: "https://youtu.be/x", handlerId: "native:video" }));

  expect((await registry.resolve(node({ name: "Movie.url", kind: "shortcut", mime: "application/octet-stream" }), shortcut)).map(({ id }) => id)).toEqual([
    "native:video",
    "native:browser",
  ]);
});

test("Open With model preserves candidate ordering and delegates execution to OpenService", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:text"));
  registry.registerHandler(handler("native:markdown"));
  registry.registerRule({ id: "markdown", handlerId: "native:markdown", extensions: [".md"], priority: 20 });
  registry.registerRule({ id: "text", handlerId: "native:text", extensions: [".md"], priority: 10 });
  const calls: Array<{ handlerId: string; target: OpenTarget }> = [];
  const openWith = new OpenWithServiceModel(registry, {
    async open(handlerId, target) { calls.push({ handlerId, target }); },
  });

  const model = await openWith.model(node());
  expect(model.candidates.map(({ handler: item }) => item.id)).toEqual(["native:markdown", "native:text"]);
  expect(model.candidates[0]?.isDefault).toBe(true);
  await openWith.open(node(), "native:text");
  expect(calls).toEqual([{ handlerId: "native:text", target: { nodeId: "node:1" } }]);
});
