import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import {
  extractTarGzEntries,
  selectRequiredEmulatorJsAssets,
} from "../emulatorJsRuntimeMaterializer.ts";

interface FixtureEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function writeTarString(target: Buffer, offset: number, length: number, value: string): void {
  Buffer.from(value, "utf8").copy(target, offset, 0, Math.min(length, Buffer.byteLength(value)));
}

function createTarGz(entries: readonly FixtureEntry[]): Uint8Array {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    writeTarString(header, 0, 100, entry.path);
    writeTarString(header, 100, 8, "0000644\0");
    writeTarString(header, 108, 8, "0000000\0");
    writeTarString(header, 116, 8, "0000000\0");
    writeTarString(header, 124, 12, `${entry.bytes.byteLength.toString(8).padStart(11, "0")}\0`);
    writeTarString(header, 136, 12, "00000000000\0");
    header[156] = "0".charCodeAt(0);
    writeTarString(header, 257, 6, "ustar\0");
    blocks.push(header, Buffer.from(entry.bytes));
    const padding = (512 - (entry.bytes.byteLength % 512)) % 512;
    if (padding > 0) blocks.push(Buffer.alloc(padding));
  }
  blocks.push(Buffer.alloc(1024));
  return new Uint8Array(gzipSync(Buffer.concat(blocks)));
}

const loader = new TextEncoder().encode("window.EJS = true;");
const css = new TextEncoder().encode("#game { display: block; }");
const core = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

test("EmulatorJS materializer extracts package tgz entries and selects only declared assets", () => {
  const runtimeArchive = createTarGz([
    { path: "package/data/loader.js", bytes: loader },
    { path: "package/data/emulator.min.css", bytes: css },
    { path: "package/ignored.txt", bytes: new Uint8Array([1]) },
  ]);
  const coreArchive = createTarGz([
    { path: "package/fceumm-wasm.data", bytes: core },
  ]);

  const runtimeEntries = extractTarGzEntries(runtimeArchive);
  const coreEntries = extractTarGzEntries(coreArchive);
  expect(runtimeEntries.map(({ path }) => path)).toEqual([
    "data/loader.js",
    "data/emulator.min.css",
    "ignored.txt",
  ]);

  const selected = selectRequiredEmulatorJsAssets(
    [runtimeEntries, coreEntries],
    ["loader.js", "emulator.min.css", "cores/fceumm-wasm.data"],
  );
  expect([...selected.keys()]).toEqual([
    "loader.js",
    "emulator.min.css",
    "cores/fceumm-wasm.data",
  ]);
  expect(selected.get("loader.js")).toEqual(loader);
  expect(selected.get("emulator.min.css")).toEqual(css);
  expect(selected.get("cores/fceumm-wasm.data")).toEqual(core);
});

test("EmulatorJS materializer fails closed on missing or ambiguous declared assets", () => {
  const entries = extractTarGzEntries(createTarGz([
    { path: "package/data/loader.js", bytes: loader },
    { path: "package/alt/data/loader.js", bytes: loader },
  ]));

  expect(() => selectRequiredEmulatorJsAssets([entries], ["emulator.min.js"]))
    .toThrow("missing required asset emulator.min.js");
  expect(() => selectRequiredEmulatorJsAssets([entries], ["loader.js"]))
    .toThrow("ambiguous required asset loader.js");
});

test("EmulatorJS tgz extraction rejects archive traversal", () => {
  const archive = createTarGz([{ path: "package/../escape.js", bytes: loader }]);
  expect(() => extractTarGzEntries(archive)).toThrow("Unsafe EmulatorJS archive path");
});
