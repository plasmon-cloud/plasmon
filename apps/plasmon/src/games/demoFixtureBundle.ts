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

/**
 * Tiny Plasmon-authored DOS program used only as a legal package/runtime proof.
 *
 * COM equivalent (ORG 100h): print instructions, wait for a key without echo,
 * print "Point!" for SPACE, and quit for Q/q. The machine code and strings are
 * authored in this repository, so the generated fixture contains no third-party
 * game content.
 */
function demoCom(): Uint8Array {
  const code = Uint8Array.from([
    0xba, 0x00, 0x00, // mov dx, message
    0xb4, 0x09,       // mov ah, 09h
    0xcd, 0x21,       // int 21h
    0xb4, 0x08,       // loop: mov ah, 08h
    0xcd, 0x21,       // int 21h
    0x3c, 0x71,       // cmp al, 'q'
    0x74, 0x11,       // je quit
    0x3c, 0x51,       // cmp al, 'Q'
    0x74, 0x0d,       // je quit
    0x3c, 0x20,       // cmp al, ' '
    0x75, 0xf0,       // jne loop
    0xba, 0x00, 0x00, // mov dx, point
    0xb4, 0x09,       // mov ah, 09h
    0xcd, 0x21,       // int 21h
    0xeb, 0xe7,       // jmp loop
    0xb8, 0x00, 0x4c, // quit: mov ax, 4c00h
    0xcd, 0x21,       // int 21h
  ]);
  const message = encoder.encode("PLASMON DEMO GAME\r\nPress SPACE to score. Press Q to quit.\r\n$");
  const point = encoder.encode("Point!\r\n$");
  const messageAddress = 0x100 + code.length;
  const pointAddress = messageAddress + message.length;
  code[1] = messageAddress & 0xff;
  code[2] = messageAddress >>> 8;
  code[24] = pointAddress & 0xff;
  code[25] = pointAddress >>> 8;
  return concat([code, message, point]);
}

const DOSBOX_CONF = `[dosbox]\nmemsize=16\n\n[cpu]\ncore=auto\ncycles=auto\n\n[autoexec]\nmount c .\nc:\nPLASMON.COM\n`;

const README = `Plasmon Demo Game fixture\r\n\r\nThis tiny keyboard demo and its generated bundle are authored by Plasmon contributors\r\nand distributed under the repository GNU GPL version 3 license. It contains no\r\ncommercial or third-party game data.\r\n\r\nPress SPACE to print a point. Press Q to exit the demo program.\r\n\r\nCorresponding source: apps/plasmon/src/games/demoFixtureBundle.ts\r\n`;

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
