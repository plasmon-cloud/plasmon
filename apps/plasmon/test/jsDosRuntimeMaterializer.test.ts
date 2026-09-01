import { expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { extractRequiredZipEntries } from "../jsDosRuntimeMaterializer.ts";

interface FixtureEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly compression?: 0 | 8;
}

function createZip(entries: readonly FixtureEntry[]): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const source = Buffer.from(entry.bytes);
    const compression = entry.compression ?? 8;
    const compressed = compression === 8 ? deflateRawSync(source) : source;
    const local = Buffer.alloc(30 + name.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(compression, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(compression, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const locals = Buffer.concat(localParts);
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(locals.length, 16);
  end.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([locals, central, end]));
}

const js = new TextEncoder().encode("window.Dos = () => ({ save: async () => true, stop: async () => {} });");
const css = new TextEncoder().encode(".jsdos-player { display: block; }");
const wasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

const archive = createZip([
  { name: "js-dos.js", bytes: js },
  { name: "js-dos.css", bytes: css, compression: 0 },
  { name: "emulators/emulators.js", bytes: js },
  { name: "emulators/wdosbox.js", bytes: js },
  { name: "emulators/wdosbox.wasm", bytes: wasm },
]);
const distArchive = createZip([
  { name: "dist/js-dos.js", bytes: js },
  { name: "dist/js-dos.css", bytes: css, compression: 0 },
  { name: "dist/emulators/emulators.js", bytes: js },
  { name: "dist/emulators/wdosbox.js", bytes: js },
  { name: "dist/emulators/wdosbox.wasm", bytes: wasm },
]);

test("js-dos materializer extracts only the declared exact ZIP entries", () => {
  const required = [
    "js-dos.js",
    "js-dos.css",
    "emulators/emulators.js",
    "emulators/wdosbox.js",
    "emulators/wdosbox.wasm",
  ] as const;
  const extracted = extractRequiredZipEntries(archive, required);
  expect([...extracted.keys()]).toEqual([...required]);
  expect(extracted.get("js-dos.js")).toEqual(js);
  expect(extracted.get("js-dos.css")).toEqual(css);
  expect(extracted.get("emulators/wdosbox.wasm")).toEqual(wasm);
});

test("js-dos materializer resolves the pinned release's dist-prefixed assets", () => {
  const required = [
    "js-dos.js",
    "js-dos.css",
    "emulators/emulators.js",
    "emulators/wdosbox.js",
    "emulators/wdosbox.wasm",
  ] as const;
  const extracted = extractRequiredZipEntries(distArchive, required);
  expect([...extracted.keys()]).toEqual([...required]);
  expect(extracted.get("js-dos.js")).toEqual(js);
  expect(extracted.get("emulators/wdosbox.wasm")).toEqual(wasm);
});

test("js-dos materializer fails closed when a declared runtime asset is missing", () => {
  expect(() => extractRequiredZipEntries(archive, ["emulators/missing.wasm"]))
    .toThrow("missing required asset emulators/missing.wasm");
});

test("js-dos materializer rejects unsafe declared asset paths", () => {
  expect(() => extractRequiredZipEntries(archive, ["../escape.js"]))
    .toThrow("Invalid js-dos required asset path");
});
