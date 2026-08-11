import { describe, expect, test } from "bun:test";
import {
  elementIconCandidates,
  firstLoadableIconCandidate,
  resolveElementIcon,
} from "./icon-resolver.ts";

const CANISTER_ID = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const NEUTRON_HREF = `https://${CANISTER_ID}.icp0.io/app/plasmon/index.html`;

const prefixed = (path: string): string =>
  `https://afilesa--${CANISTER_ID}.icp0.io/app/files/${path}`;
const unprefixed = (path: string): string =>
  `https://${CANISTER_ID}.icp0.io/app/files/${path}`;

test("icon candidate generation preserves safe format and origin priority", () => {
  expect(elementIconCandidates("files", NEUTRON_HREF)).toEqual([
    prefixed("static/icon.svg"),
    prefixed("static/icon.png"),
    prefixed("static/icon.webp"),
    prefixed("static/icon.jpg"),
    unprefixed("static/icon.svg"),
    unprefixed("static/icon.png"),
    unprefixed("static/icon.webp"),
    unprefixed("static/icon.jpg"),
  ]);
});

describe("verified icon selection", () => {
  const candidates = ["A.svg", "A.png", "A.webp", "A.jpg"];

  test("returns the first candidate when it loads", async () => {
    expect(await firstLoadableIconCandidate(
      candidates,
      async (candidate) => candidate === "A.svg",
    )).toBe("A.svg");
  });

  test("returns the second candidate when the first fails", async () => {
    expect(await firstLoadableIconCandidate(
      candidates,
      async (candidate) => candidate === "A.png",
    )).toBe("A.png");
  });

  test("preserves candidate priority across multiple failures", async () => {
    expect(await firstLoadableIconCandidate(
      candidates,
      async (candidate) => candidate === "A.webp" || candidate === "A.jpg",
    )).toBe("A.webp");
  });

  test("returns undefined when every candidate fails", async () => {
    expect(await firstLoadableIconCandidate(candidates, async () => false)).toBeUndefined();
  });

  test("a stalled candidate is bounded and cannot hang resolution", async () => {
    const stalled = new Promise<boolean>(() => {});
    expect(await firstLoadableIconCandidate(
      ["A.svg", "A.png"],
      (candidate) => candidate === "A.svg" ? stalled : true,
      10,
    )).toBe("A.png");
  });
});

test("resolveElementIcon probes generated candidates instead of trusting index zero", async () => {
  const candidates = elementIconCandidates("files", NEUTRON_HREF);
  const working = candidates[5];
  if (!working) throw new Error("expected unprefixed PNG candidate");

  expect(await resolveElementIcon("files", NEUTRON_HREF, {
    probe: async (candidate) => candidate === working,
    timeoutMs: 50,
  })).toBe(working);
});

test("icon resolution is inert without a Neutron app URL", async () => {
  expect(elementIconCandidates("files", "https://example.com/desktop")).toEqual([]);
  expect(await resolveElementIcon("files", "https://example.com/desktop", {
    probe: async () => true,
  })).toBeUndefined();
});
