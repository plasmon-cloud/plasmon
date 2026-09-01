import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createPlasmonNesTestRom } from "./emulatorJsFixture.ts";
import { createPlasmonNesDemoRom } from "./demoNesBundle.ts";
import { DEMO_NES_BYTES, DEMO_NES_SHA256 } from "./demoNesContract.ts";

function sri(bytes: Uint8Array): string {
  return `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
}

test("repository-authored NES Demo is deterministic mapper-0 interactive content", () => {
  const rom = createPlasmonNesDemoRom();
  expect(rom.byteLength).toBe(DEMO_NES_BYTES);
  expect(sri(rom)).toBe(DEMO_NES_SHA256);
  expect(Array.from(rom.slice(0, 8))).toEqual([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x01, 0x00, 0x00]);
  expect((rom[6] ?? 0) >> 4).toBe(0);
  expect((rom[7] ?? 0) & 0xf0).toBe(0);

  // The Demo homebrew must not silently become the test-only EmulatorJS ROM.
  expect(rom).not.toEqual(createPlasmonNesTestRom());

  // Production code reads $4016 and mutates the sprite's OAM X/Y coordinates.
  const prg = rom.slice(16, 16 + 16_384);
  const readsController = prg.some((byte, index) =>
    byte === 0xad && prg[index + 1] === 0x16 && prg[index + 2] === 0x40
  );
  const updatesOam = prg.some((byte, index) =>
    (byte === 0xce || byte === 0xee)
    && prg[index + 1] !== undefined
    && prg[index + 2] === 0x02
  );
  expect(readsController).toBe(true);
  expect(updatesOam).toBe(true);
});
