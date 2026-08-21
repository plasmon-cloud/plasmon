import { expect, test } from "bun:test";
import { applyIncomingDesktopDropPositions } from "./layout.ts";

test("#371 free incoming Desktop drop keeps the proposed ghost position", () => {
  const current = {
    incumbent: { x: 16, y: 16 },
  };
  const next = applyIncomingDesktopDropPositions(
    current,
    ["incumbent"],
    [{ id: "incoming", x: 640, y: 420 }],
    { width: 1200, height: 760 },
  );

  expect(next.incoming).toEqual({ x: 640, y: 420 });
  expect(next.incumbent).toEqual({ x: 16, y: 16 });
});

test("#371 incoming Desktop drop is clamped only by canonical workspace bounds", () => {
  const next = applyIncomingDesktopDropPositions(
    {},
    [],
    [{ id: "incoming", x: 990, y: 790 }],
    { width: 800, height: 600 },
  );

  expect(next.incoming).toEqual({ x: 708, y: 512 });
});

test("#371 incoming drop cannot steal an incumbent Desktop position", () => {
  const next = applyIncomingDesktopDropPositions(
    { incumbent: { x: 224, y: 224 } },
    ["incumbent"],
    [{ id: "incoming", x: 224, y: 224 }],
    { width: 1000, height: 700 },
  );

  expect(next.incumbent).toEqual({ x: 224, y: 224 });
  expect(next.incoming).not.toEqual({ x: 224, y: 224 });
});
