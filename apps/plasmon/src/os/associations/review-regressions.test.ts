import { expect, test } from "bun:test";
import type { AtomDescriptor, FsNode, HandlerDefinition } from "../contracts/index.ts";
import {
  HandlerAssociationRegistry,
  OpenWithServiceModel,
  atomMetadata,
  createAtomPackage,
  crc32,
  tryParseAtomPackage,
} from "./index.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const noopOpenService = { async open() {} };

function handler(id: string): HandlerDefinition {
  return { id, kind: "native", name: id, icon: "system:test", capabilities: ["read"] };
}

function node(patch: Partial<FsNode> = {}): FsNode {
  return {
    id: "node:review",
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
  atomId: "atom:review",
  handlerId: "unregistered:descriptor-handler",
  atomType: "spreadsheet/v1",
  schemaVersion: 1,
};

test("Set Default uses MIME when selected handler matches only MIME", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:markdown"));
  registry.registerHandler(handler("native:text"));
  registry.registerRule({ id: "markdown-extension", handlerId: "native:markdown", extensions: [".md"], priority: 10 });
  registry.registerRule({ id: "text-mime", handlerId: "native:text", mimeTypes: ["text/markdown"], priority: 10 });
  const openWith = new OpenWithServiceModel(registry, noopOpenService);

  expect(await openWith.setDefault(node(), "native:text")).toBe("mime:text/markdown");
  expect((await registry.resolve(node())).map(({ id }) => id)).toEqual(["native:markdown", "native:text"]);
});

test("Set Default uses ordinary extension when selected handler also matches MIME", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:text"));
  registry.registerRule({
    id: "text",
    handlerId: "native:text",
    extensions: [".md"],
    mimeTypes: ["text/markdown"],
    priority: 1,
  });
  const openWith = new OpenWithServiceModel(registry, noopOpenService);

  expect(await openWith.setDefault(node(), "native:text")).toBe("extension:.md");
});

test("Set Default selects the actual compound-extension matcher", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:sheet"));
  registry.registerRule({
    id: "sheet",
    handlerId: "native:sheet",
    extensions: [".atom", ".spreadsheet.atom"],
    priority: 1,
  });
  const resource = node({ name: "Budget.spreadsheet.atom", kind: "atom", mime: "application/octet-stream" });
  const openWith = new OpenWithServiceModel(registry, noopOpenService);

  expect(await openWith.setDefault(resource, "native:sheet")).toBe("extension:.spreadsheet.atom");
});

test("Set Default selects the Atom-type matcher", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:sheet-a"));
  registry.registerHandler(handler("native:sheet-b"));
  registry.registerRule({ id: "sheet-a", handlerId: "native:sheet-a", atomTypes: ["spreadsheet/v1"], priority: 10 });
  registry.registerRule({ id: "sheet-b", handlerId: "native:sheet-b", atomTypes: ["spreadsheet/v1"], priority: 1 });
  const resource = node({
    name: "Budget.atom",
    kind: "atom",
    mime: "application/octet-stream",
    metadata: { atom: atomMetadata(atom) },
  });
  const openWith = new OpenWithServiceModel(registry, noopOpenService);

  expect(await openWith.setDefault(resource, "native:sheet-b")).toBe("atom:spreadsheet/v1");
  expect((await registry.resolve(resource))[0]?.id).toBe("native:sheet-b");
});

test("Set Default makes the selected handler resolve first when source precedence allows", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(handler("native:high-priority"));
  registry.registerHandler(handler("native:selected"));
  registry.registerRule({ id: "high", handlerId: "native:high-priority", extensions: [".md"], priority: 100 });
  registry.registerRule({ id: "selected", handlerId: "native:selected", extensions: [".md"], priority: 1 });
  const openWith = new OpenWithServiceModel(registry, noopOpenService);

  expect((await registry.resolve(node()))[0]?.id).toBe("native:high-priority");
  expect(await openWith.setDefault(node(), "native:selected")).toBe("extension:.md");
  expect((await registry.resolve(node()))[0]?.id).toBe("native:selected");
});

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function u16(value: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

interface TestZipEntry {
  name: string;
  actual: Uint8Array;
  method?: 0 | 8;
  compressed?: Uint8Array;
  declaredSize?: number;
  expectedCrc?: number;
}

function makeZip(entries: readonly TestZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const method = entry.method ?? 0;
    const compressed = entry.compressed ?? entry.actual;
    const declaredSize = entry.declaredSize ?? entry.actual.length;
    const expectedCrc = entry.expectedCrc ?? crc32(entry.actual);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(0), u16(0),
      u32(expectedCrc), u32(compressed.length), u32(declaredSize), u16(name.length), u16(0), name, compressed,
    ]);
    locals.push(local);
    centrals.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(0), u16(0),
      u32(expectedCrc), u32(compressed.length), u32(declaredSize), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(localOffset), name,
    ]));
    localOffset += local.length;
  }

  const central = concat(centrals);
  return concat([
    ...locals,
    central,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(localOffset), u16(0),
  ]);
}

function manifest(payloadEntry = "payload.bin"): Uint8Array {
  return encoder.encode(JSON.stringify({
    format: "plasmon.atom",
    version: 1,
    atomId: "atom:zip-review",
    handler: { id: "native:test" },
    atomType: "test/v1",
    schemaVersion: 1,
    payload: { entry: payloadEntry },
  }));
}

const NORMAL_DEFLATED_PAYLOAD = new Uint8Array([75, 73, 77, 203, 73, 44, 73, 77, 81, 40, 72, 172, 204, 201, 79, 76, 1, 0]);
const OVERSIZED_DEFLATED_PAYLOAD = new Uint8Array([237, 193, 1, 13, 0, 0, 0, 194, 160, 108, 239, 95, 202, 28, 110, 64, 1, 0, 0, 0, 0, 0, 0, 0, 239, 6]);

test("Atom package parser retains normal stored ZIP support", async () => {
  const descriptor: AtomDescriptor = {
    format: "plasmon.atom", version: 1, atomId: "atom:stored", handlerId: "native:test", atomType: "test/v1", schemaVersion: 1,
  };
  const parsed = await tryParseAtomPackage(createAtomPackage({ descriptor, payload: encoder.encode("stored payload") }));
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(decoder.decode(parsed.package.payload)).toBe("stored payload");
});

test("Atom package parser retains normal deflated ZIP support", async () => {
  const payload = encoder.encode("deflated payload");
  const parsed = await tryParseAtomPackage(makeZip([
    { name: "atom.json", actual: manifest() },
    { name: "payload.bin", actual: payload, method: 8, compressed: NORMAL_DEFLATED_PAYLOAD },
  ]));
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(decoder.decode(parsed.package.payload)).toBe("deflated payload");
});

test("Atom package parser retains CRC integrity rejection", async () => {
  const parsed = await tryParseAtomPackage(makeZip([
    { name: "atom.json", actual: manifest() },
    { name: "payload.bin", actual: encoder.encode("bad crc"), expectedCrc: 0 },
  ]));
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.code).toBe("integrity_error");
});

test("Atom package parser retains unsafe path rejection", async () => {
  const parsed = await tryParseAtomPackage(makeZip([{ name: "../escape", actual: encoder.encode("x") }]));
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.code).toBe("unsafe_path");
});

test("Atom package parser retains malformed archive handling", async () => {
  const parsed = await tryParseAtomPackage(encoder.encode("not a zip"));
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.code).toBe("not_zip");
});

test("deflate expansion is rejected from actual output before accepting forged declared size", async () => {
  const actualPayload = encoder.encode("A".repeat(8192));
  const parsed = await tryParseAtomPackage(makeZip([
    { name: "atom.json", actual: manifest() },
    {
      name: "payload.bin",
      actual: actualPayload,
      method: 8,
      compressed: OVERSIZED_DEFLATED_PAYLOAD,
      declaredSize: 8,
    },
  ]), { maxUncompressedBytes: 512 });

  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.error.code).toBe("too_large");
});
