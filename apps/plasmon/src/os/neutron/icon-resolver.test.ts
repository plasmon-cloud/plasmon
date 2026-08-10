import { expect, test } from "bun:test";
import { elementIconCandidates, resolveElementIcon } from "./icon-resolver.ts";

test("icon resolution is inert without a Neutron app URL", () => {
  expect(elementIconCandidates("files", "https://example.com/desktop")).toEqual([]);
  expect(resolveElementIcon("files", "https://example.com/desktop")).toBeUndefined();
});
