const encoder = new TextEncoder();

interface StoredZipEntry {
  name: string;
  bytes: Uint8Array;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries: readonly StoredZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 33, true); // 1980-01-01, deterministic DOS date.
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.bytes.length, true);
    localView.setUint32(22, entry.bytes.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 33, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);

    localOffset += local.length + entry.bytes.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return concat([...localParts, centralDirectory, end]);
}

type DemoFixup = { at: number; label: string; kind: "absolute16" | "relative8" };

/**
 * Tiny Plasmon-authored DOS program used only as a legal package/runtime proof.
 *
 * The fixture creates SCORE.DAT only after SPACE is received. Later runs print
 * a restored-progress message when that file is present, so packaged acceptance
 * cannot claim restored gameplay unless real keyboard input mutated engine state.
 */
function demoCom(): Uint8Array {
  const code: number[] = [];
  const labels = new Map<string, number>();
  const fixups: DemoFixup[] = [];
  const emit = (...bytes: number[]) => code.push(...bytes);
  const mark = (label: string) => labels.set(label, code.length);
  const movDx = (label: string) => {
    emit(0xba, 0x00, 0x00);
    fixups.push({ at: code.length - 2, label, kind: "absolute16" });
  };
  const jump8 = (opcode: number, label: string) => {
    emit(opcode, 0x00);
    fixups.push({ at: code.length - 1, label, kind: "relative8" });
  };

  movDx("message");
  emit(0xb4, 0x09, 0xcd, 0x21); // print instructions

  // If SCORE.DAT exists, close it and announce that saved gameplay was restored.
  movDx("scoreName");
  emit(0xb8, 0x00, 0x3d, 0xcd, 0x21); // open read-only
  jump8(0x72, "inputLoop"); // first run has no score file
  emit(0x89, 0xc3, 0xb4, 0x3e, 0xcd, 0x21); // mov bx,ax; close
  movDx("restored");
  emit(0xb4, 0x09, 0xcd, 0x21);

  mark("inputLoop");
  emit(0xb4, 0x08, 0xcd, 0x21); // read key without echo
  emit(0x3c, 0x71); // cmp al,'q'
  jump8(0x74, "quit");
  emit(0x3c, 0x51); // cmp al,'Q'
  jump8(0x74, "quit");
  emit(0x3c, 0x20); // cmp al,' '
  jump8(0x75, "inputLoop");

  // SPACE records a point by creating/replacing SCORE.DAT with the byte "1".
  movDx("scoreName");
  emit(0x31, 0xc9, 0xb4, 0x3c, 0xcd, 0x21);
  jump8(0x72, "printPoint");
  emit(0x89, 0xc3);
  movDx("scoreValue");
  emit(0xb9, 0x01, 0x00, 0xb4, 0x40, 0xcd, 0x21);
  emit(0xb4, 0x3e, 0xcd, 0x21);

  mark("printPoint");
  movDx("point");
  emit(0xb4, 0x09, 0xcd, 0x21);
  jump8(0xeb, "inputLoop");

  mark("quit");
  emit(0xb8, 0x00, 0x4c, 0xcd, 0x21);

  mark("message");
  emit(...encoder.encode("PLASMON DEMO GAME\r\nPress SPACE to score. Press Q to quit.\r\n$"));
  mark("restored");
  emit(...encoder.encode("Restored saved progress.\r\n$"));
  mark("point");
  emit(...encoder.encode("Point!\r\n$"));
  mark("scoreName");
  emit(...encoder.encode("SCORE.DAT\0"));
  mark("scoreValue");
  emit(0x31);

  for (const fixup of fixups) {
    const target = labels.get(fixup.label);
    if (target === undefined) throw new Error(`Missing demo label: ${fixup.label}`);
    if (fixup.kind === "absolute16") {
      const address = 0x100 + target;
      code[fixup.at] = address & 0xff;
      code[fixup.at + 1] = (address >>> 8) & 0xff;
      continue;
    }
    const displacement = target - (fixup.at + 1);
    if (displacement < -128 || displacement > 127) {
      throw new Error(`Demo jump out of range: ${fixup.label}`);
    }
    code[fixup.at] = displacement & 0xff;
  }

  return Uint8Array.from(code);
}

const DOSBOX_CONF = `[dosbox]\nmemsize=16\n\n[cpu]\ncore=auto\ncycles=auto\n\n[autoexec]\nmount c .\nc:\nPLASMON.COM\n`;

const README = `Plasmon Demo Game fixture\r\n\r\nThis tiny keyboard demo and its generated bundle are authored by Plasmon contributors\r\nand distributed under the repository GNU GPL version 3 license. It contains no\r\ncommercial or third-party game data.\r\n\r\nPress SPACE to create SCORE.DAT and record a point. Reopening a restored js-dos\r\nchange set prints a saved-progress message. Press Q to quit.\r\n\r\nCorresponding source: apps/plasmon/src/games/demoFixtureBundle.ts\r\n`;

export const PACKAGED_DEMO_GAME_FILENAME = "PlasmonDemo.jsdos";
export const DEMO_GAME_RESOURCE_NAME = "Plasmon Demo.jsdos";
export const DEMO_GAME_MIME = "application/x-jsdos";

/** Deterministically builds the exact redistributable .jsdos package fixture. */
export function createPlasmonDemoGameBundle(): Uint8Array {
  return storedZip([
    { name: ".jsdos/dosbox.conf", bytes: encoder.encode(DOSBOX_CONF) },
    { name: "PLASMON.COM", bytes: demoCom() },
    { name: "README.TXT", bytes: encoder.encode(README) },
  ]);
}
