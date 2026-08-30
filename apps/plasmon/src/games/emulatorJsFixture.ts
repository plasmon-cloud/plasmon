export const PACKAGED_EMULATORJS_TEST_FILENAME = "PlasmonTest.nes";

/**
 * Repository-owned mapper-0/NROM acceptance image. This is deliberately a
 * test-only proof resource, not Demo/Base user content and not a third-party ROM.
 */
export function createPlasmonNesTestRom(): Uint8Array {
  const headerBytes = 16;
  const prgBytes = 16_384;
  const chrBytes = 8_192;
  const rom = new Uint8Array(headerBytes + prgBytes + chrBytes);

  // iNES 1.0, mapper 0 / NROM-128, one PRG bank, one CHR bank, no battery SRAM.
  rom.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x01, 0x00, 0x00], 0);

  // Minimal original 6502 program: initialize the stack, then remain in a
  // stable loop. No commercial or third-party game data is included.
  rom.set([0x78, 0xd8, 0xa2, 0xff, 0x9a, 0x4c, 0x05, 0x80], headerBytes);
  const vectors = headerBytes + prgBytes - 6;
  rom.set([
    0x00, 0x80,
    0x00, 0x80,
    0x00, 0x80,
  ], vectors);
  return rom;
}
