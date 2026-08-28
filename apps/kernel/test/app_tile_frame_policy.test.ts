import { expect, test } from "bun:test";
import { APP_TILE_FRAME_SANDBOX } from "../src/workspace/app_tile_frame_policy.ts";

test("installed app tile frames permit downloads without broadening sandbox authority", () => {
  const tokens = new Set(APP_TILE_FRAME_SANDBOX.split(/\s+/).filter(Boolean));

  expect(tokens).toEqual(new Set(["allow-scripts", "allow-downloads"]));
  expect(tokens.has("allow-same-origin")).toBe(false);
  expect(tokens.has("allow-popups")).toBe(false);
  expect(tokens.has("allow-forms")).toBe(false);
});
