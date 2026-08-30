/**
 * Repository-authored interactive NES/NROM homebrew used only by the Demo
 * overlay. It is intentionally distinct from the EmulatorJS test-only proof
 * ROM: this one renders a checkerboard and lets the user move a sprite with
 * the directional pad.
 */
export function createPlasmonNesDemoRom(): Uint8Array {
  const headerBytes = 16;
  const prgBytes = 16_384;
  const chrBytes = 8_192;
  const rom = new Uint8Array(headerBytes + prgBytes + chrBytes);
  rom.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x01, 0x00, 0x00], 0);

  const prg = new Uint8Array(prgBytes);
  prg.fill(0xea);
  let cursor = 0;
  const labels = new Map<string, number>();
  const relativePatches: Array<{ offset: number; label: string }> = [];
  const absolutePatches: Array<{ offset: number; label: string }> = [];

  const emit = (...bytes: number[]) => {
    prg.set(bytes, cursor);
    cursor += bytes.length;
  };
  const label = (name: string) => labels.set(name, 0x8000 + cursor);
  const branch = (opcode: number, target: string) => {
    emit(opcode, 0x00);
    relativePatches.push({ offset: cursor - 1, label: target });
  };
  const jump = (target: string) => {
    emit(0x4c, 0x00, 0x00);
    absolutePatches.push({ offset: cursor - 2, label: target });
  };

  // Disable interrupts/rendering and wait for the PPU to become ready.
  emit(
    0x78, 0xd8, 0xa2, 0x40, 0x8e, 0x17, 0x40, 0xa2, 0xff, 0x9a, 0xe8,
    0x8e, 0x00, 0x20, 0x8e, 0x01, 0x20, 0x8e, 0x10, 0x40,
  );
  label("wait-vblank");
  emit(0x2c, 0x02, 0x20);
  branch(0x10, "wait-vblank");

  // Background palette (blue + white checkerboard).
  emit(
    0xa9, 0x3f, 0x8d, 0x06, 0x20, 0xa9, 0x00, 0x8d, 0x06, 0x20,
    0xa9, 0x11, 0x8d, 0x07, 0x20, 0xa9, 0x30, 0x8d, 0x07, 0x20,
  );
  // Sprite palette (blue universal background + green square).
  emit(
    0xa9, 0x3f, 0x8d, 0x06, 0x20, 0xa9, 0x10, 0x8d, 0x06, 0x20,
    0xa9, 0x11, 0x8d, 0x07, 0x20, 0xa9, 0x2a, 0x8d, 0x07, 0x20,
  );

  // Fill the first nametable with checkerboard tile 1.
  emit(0xa9, 0x20, 0x8d, 0x06, 0x20, 0xa9, 0x00, 0x8d, 0x06, 0x20, 0xa2, 0x04);
  label("fill-page");
  emit(0xa0, 0x00);
  label("fill-byte");
  emit(0xa9, 0x01, 0x8d, 0x07, 0x20, 0xc8);
  branch(0xd0, "fill-byte");
  emit(0xca);
  branch(0xd0, "fill-page");

  // Clear OAM shadow and install one movable sprite using tile 2.
  emit(0xa2, 0x00, 0xa9, 0xff);
  label("clear-oam");
  emit(0x9d, 0x00, 0x02, 0xe8);
  branch(0xd0, "clear-oam");
  emit(
    0xa9, 0x70, 0x8d, 0x00, 0x02,
    0xa9, 0x02, 0x8d, 0x01, 0x02,
    0xa9, 0x00, 0x8d, 0x02, 0x02,
    0xa9, 0x78, 0x8d, 0x03, 0x02,
    0xa9, 0x00, 0x8d, 0x03, 0x20,
    0xa9, 0x02, 0x8d, 0x14, 0x40,
    0xa9, 0x00, 0x8d, 0x05, 0x20, 0x8d, 0x05, 0x20,
    0xa9, 0x18, 0x8d, 0x01, 0x20,
  );

  // Poll once per frame. The first four reads are A/B/Select/Start; the
  // remaining four D-pad reads move the sprite in OAM shadow memory.
  label("main");
  emit(0x2c, 0x02, 0x20);
  branch(0x10, "main");
  emit(0xa9, 0x01, 0x8d, 0x16, 0x40, 0xa9, 0x00, 0x8d, 0x16, 0x40);
  for (let index = 0; index < 4; index += 1) emit(0xad, 0x16, 0x40);

  emit(0xad, 0x16, 0x40, 0x29, 0x01);
  branch(0xf0, "no-up");
  emit(0xce, 0x00, 0x02);
  label("no-up");

  emit(0xad, 0x16, 0x40, 0x29, 0x01);
  branch(0xf0, "no-down");
  emit(0xee, 0x00, 0x02);
  label("no-down");

  emit(0xad, 0x16, 0x40, 0x29, 0x01);
  branch(0xf0, "no-left");
  emit(0xce, 0x03, 0x02);
  label("no-left");

  emit(0xad, 0x16, 0x40, 0x29, 0x01);
  branch(0xf0, "no-right");
  emit(0xee, 0x03, 0x02);
  label("no-right");

  emit(0xa9, 0x00, 0x8d, 0x03, 0x20, 0xa9, 0x02, 0x8d, 0x14, 0x40);
  jump("main");

  for (const patch of relativePatches) {
    const target = labels.get(patch.label);
    if (target === undefined) throw new Error(`Unknown NES demo branch label: ${patch.label}`);
    const nextAddress = 0x8000 + patch.offset + 1;
    const displacement = target - nextAddress;
    if (displacement < -128 || displacement > 127) {
      throw new Error(`NES demo branch ${patch.label} is out of range`);
    }
    prg[patch.offset] = displacement & 0xff;
  }
  for (const patch of absolutePatches) {
    const target = labels.get(patch.label);
    if (target === undefined) throw new Error(`Unknown NES demo jump label: ${patch.label}`);
    prg[patch.offset] = target & 0xff;
    prg[patch.offset + 1] = (target >>> 8) & 0xff;
  }

  // NMI, Reset, and IRQ vectors all return to the deterministic reset entry.
  for (const vectorOffset of [0x3ffa, 0x3ffc, 0x3ffe]) {
    prg[vectorOffset] = 0x00;
    prg[vectorOffset + 1] = 0x80;
  }
  rom.set(prg, headerBytes);

  const chrOffset = headerBytes + prgBytes;
  for (let row = 0; row < 8; row += 1) {
    rom[chrOffset + 16 + row] = row % 2 === 0 ? 0xaa : 0x55;
    rom[chrOffset + 32 + row] = 0xff;
  }
  return rom;
}
