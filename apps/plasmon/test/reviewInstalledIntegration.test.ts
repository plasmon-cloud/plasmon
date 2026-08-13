import { describe, expect, test } from "bun:test";
import type { ExternalElement } from "../src/os/contracts/index.ts";
import {
  NEUTRON_APP_MIME,
  readNeutronAppMetadata,
} from "../src/os/fs/resourcePolicy.ts";
import { searchShell } from "../src/os/shell/search.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

const reviewElement: ExternalElement = {
  id: "review",
  name: "Review",
  description: "Collaborative review workspace.",
  version: 1,
  icon: "/app/review/icon.svg",
  tiles: [{ id: "review", title: "Review" }],
  running: "no",
};

describe("installed Review application integration", () => {
  test("projects Review once with canonical identity and opens through the filesystem bridge", async () => {
    const env = createHeadlessPlasmonEnvironment({
      // Duplicate discovery input deliberately proves projection identity is
      // keyed by the Kernel-owned application id rather than discovery count.
      elements: [reviewElement, reviewElement],
    });

    try {
      const ready = await env.ready;
      expect(ready.neutronProjectionError).toBeNull();

      const apps = await env.node("/Apps");
      expect(apps?.kind).toBe("directory");
      if (!apps || apps.kind !== "directory") throw new Error("/Apps was not projected");

      const entries = await env.services.fs.list(apps.id, {
        includeHidden: true,
        sort: "name",
      });
      const reviewEntries = entries.filter((entry) => {
        return readNeutronAppMetadata(entry)?.elementId === "review";
      });

      expect(reviewEntries).toHaveLength(1);
      const review = reviewEntries[0]!;
      expect(review.name).toBe("Review.neutron");
      expect(review.mime).toBe(NEUTRON_APP_MIME);
      expect(readNeutronAppMetadata(review)).toEqual({
        format: "plasmon-neutron-app",
        version: 1,
        elementId: "review",
        name: "Review",
        description: "Collaborative review workspace.",
        appVersion: 1,
        icon: "/app/review/icon.svg",
      });

      await env.open("/Apps/Review.neutron");

      expect(env.neutronMessages).toEqual([
        "[Plasmon preview] Open Review/review",
      ]);
      expect(env.processes()).toHaveLength(0);
      expect(env.windows()).toHaveLength(0);
    } finally {
      env.dispose();
    }
  });

  test("coalesces Kernel discovery and the /Apps projection into one Review Search result", async () => {
    const env = createHeadlessPlasmonEnvironment({ elements: [reviewElement] });

    try {
      await env.ready;
      const discovered = await env.neutron.loadElements();
      const batch = await searchShell(
        env.services.fs,
        env.services.nativeApps.list(),
        discovered,
        "Review",
      );
      const reviewResults = batch.results.filter((result) => result.id === "element:review");

      expect(reviewResults).toHaveLength(1);
      expect(reviewResults[0]).toMatchObject({
        kind: "neutron-projection",
        title: "Review",
        elementId: "review",
      });
    } finally {
      env.dispose();
    }
  });
});
