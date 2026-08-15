import { describe, expect, test } from "bun:test";
import {
  declaredElementIconPath,
  elementIconCandidates,
  firstLoadableIconCandidate,
  resolveElementIcon,
  safePackageIconPath,
} from "./icon-resolver.ts";

const CANISTER_ID = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const NEUTRON_HREF = `https://${CANISTER_ID}.icp0.io/app/plasmon/index.html`;

const prefixed = (path: string): string =>
  `https://afilesa--${CANISTER_ID}.icp0.io/app/files/${path}`;
const unprefixed = (path: string): string =>
  `https://${CANISTER_ID}.icp0.io/app/files/${path}`;

describe("descriptor icon path policy", () => {
  test("accepts bounded package-local paths", () => {
    expect(safePackageIconPath("static/icon.svg")).toBe("static/icon.svg");
    expect(safePackageIconPath("assets/icons/app mark.webp")).toBe(
      "assets/icons/app mark.webp",
    );
  });

  test("rejects external, scheme-relative, unsafe-scheme and escaping paths", () => {
    for (const value of [
      "https://example.com/icon.svg",
      "//example.com/icon.svg",
      "data:image/svg+xml,test",
      "javascript:alert(1)",
      "/static/icon.svg",
      "../icon.svg",
      "static/../icon.svg",
      "static\\icon.svg",
      "static/icon.svg?x=1",
      "static/icon.svg#fragment",
      "static/%2e%2e/icon.svg",
    ]) {
      expect(safePackageIconPath(value)).toBeUndefined();
    }
  });

  test("retains declared icon metadata internally without trusting arbitrary URLs", () => {
    expect(declaredElementIconPath({
      id: "files",
      icon: "https://untrusted.example/app.png",
      tiles: [
        { id: "main", title: "Files", icon: "static/icon.svg" },
      ],
      tray: { title: "Files", icon: "static/tray.svg" },
    }, "files")).toBe("static/icon.svg");

    expect(declaredElementIconPath({
      id: "files",
      tiles: [{ id: "main", title: "Files" }],
      tray: { title: "Files", icon: "static/tray.svg" },
    }, "files")).toBe("static/tray.svg");

    expect(declaredElementIconPath({
      id: "other",
      tiles: [{ id: "main", title: "Other", icon: "static/icon.svg" }],
    }, "files")).toBeUndefined();
  });
});

test("one declared icon path produces only the two established safe origin forms", () => {
  expect(elementIconCandidates("files", "static/icon.svg", NEUTRON_HREF)).toEqual([
    prefixed("static/icon.svg"),
    unprefixed("static/icon.svg"),
  ]);
});

describe("sequential verified icon selection", () => {
  test("first success stops later candidate probes", async () => {
    const probes: string[] = [];
    expect(await firstLoadableIconCandidate(
      ["A.svg", "A.png"],
      async (candidate) => {
        probes.push(candidate);
        return true;
      },
    )).toBe("A.svg");
    expect(probes).toEqual(["A.svg"]);
  });

  test("second candidate is tried only after the first fails", async () => {
    const probes: string[] = [];
    expect(await firstLoadableIconCandidate(
      ["A.svg", "A.png"],
      async (candidate) => {
        probes.push(candidate);
        return candidate === "A.png";
      },
    )).toBe("A.png");
    expect(probes).toEqual(["A.svg", "A.png"]);
  });

  test("returns undefined when every candidate fails", async () => {
    expect(await firstLoadableIconCandidate(
      ["A.svg", "A.png"],
      async () => false,
    )).toBeUndefined();
  });

  test("a stalled first candidate times out before the second starts", async () => {
    const stalled = new Promise<boolean>(() => {});
    const probes: string[] = [];
    expect(await firstLoadableIconCandidate(
      ["A.svg", "A.png"],
      (candidate) => {
        probes.push(candidate);
        return candidate === "A.svg" ? stalled : true;
      },
      10,
    )).toBe("A.png");
    expect(probes).toEqual(["A.svg", "A.png"]);
  });
});

describe("descriptor-first and compatibility resolution", () => {
  test("safe declared icon uses only the declared path and short-circuits on success", async () => {
    const probes: string[] = [];
    expect(await resolveElementIcon("files", "assets/files.svg", NEUTRON_HREF, {
      probe: async (candidate) => {
        probes.push(candidate);
        return true;
      },
    })).toBe(prefixed("assets/files.svg"));
    expect(probes).toEqual([prefixed("assets/files.svg")]);
  });

  test("preferred declared origin failure hands the final safe origin to presentation without pre-probing it", async () => {
    const probes: string[] = [];
    expect(await resolveElementIcon("files", "assets/files.svg", NEUTRON_HREF, {
      probe: async (candidate) => {
        probes.push(candidate);
        return false;
      },
    })).toBe(unprefixed("assets/files.svg"));
    expect(probes).toEqual([prefixed("assets/files.svg")]);
  });

  test("no descriptor icon tries only the canonical SVG compatibility path", async () => {
    const probes: string[] = [];
    expect(await resolveElementIcon("files", undefined, NEUTRON_HREF, {
      probe: async (candidate) => {
        probes.push(candidate);
        return candidate === prefixed("static/icon.svg");
      },
    })).toBe(prefixed("static/icon.svg"));
    expect(probes).toEqual([prefixed("static/icon.svg")]);
  });

  test("compatibility preferred-origin failure hands off the final SVG origin without another discovery request", async () => {
    const probes: string[] = [];
    expect(await resolveElementIcon("files", undefined, NEUTRON_HREF, {
      probe: async (candidate) => {
        probes.push(candidate);
        return false;
      },
    })).toBe(unprefixed("static/icon.svg"));
    expect(probes).toEqual([prefixed("static/icon.svg")]);
    expect(probes.some((candidate) => /\.(?:png|webp|jpe?g)(?:$|\?)/u.test(candidate))).toBe(false);
  });

  test("unsafe declared metadata never becomes an arbitrary probe URL", async () => {
    const probes: string[] = [];
    expect(await resolveElementIcon(
      "files",
      "https://evil.example/icon.svg",
      NEUTRON_HREF,
      {
        probe: async (candidate) => {
          probes.push(candidate);
          return false;
        },
      },
    )).toBe(unprefixed("static/icon.svg"));
    expect(probes).toEqual([prefixed("static/icon.svg")]);
    expect(probes.some((candidate) => candidate.includes("evil.example"))).toBe(false);
  });
});
