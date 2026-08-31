import { describe, expect, test } from "bun:test";
import {
  ManagedConfigurationService,
  MemoryFsRepository,
  PersistentFsService,
  ProtectedManagedFsService,
  bootstrapFilesystem,
  parseConfigurationDocument,
} from "../fs/index.ts";
import {
  DEFAULT_VISUAL_PRESENTATION_CONFIGURATION,
  VISUAL_PRESENTATION_CONFIGURATION_DEFINITION,
  VISUAL_PRESENTATION_CONFIGURATION_PATH,
  VISUAL_PRESENTATION_SCHEMA,
  VISUAL_PRESENTATION_SCHEMA_VERSION,
  VisualPresentationConfigurationController,
  type VisualPresentationConfigurationSnapshot,
} from "./configuration.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function fixture() {
  const raw = new PersistentFsService(new MemoryFsRepository());
  await bootstrapFilesystem(raw);
  const fs = new ProtectedManagedFsService(raw);
  const configuration = new ManagedConfigurationService(raw, raw);
  const diagnostics: string[] = [];
  const diagnosticWaiters = new Map<string, Array<() => void>>();
  const visual = new VisualPresentationConfigurationController(fs, configuration, {
    onDiagnostic: (item) => {
      diagnostics.push(item.code);
      for (const resolve of diagnosticWaiters.get(item.code) ?? []) resolve();
      diagnosticWaiters.delete(item.code);
    },
  });
  await visual.ready;
  const waitForDiagnostic = (code: string): Promise<void> => {
    if (diagnostics.includes(code)) return Promise.resolve();
    return new Promise((resolve) => {
      diagnosticWaiters.set(code, [...(diagnosticWaiters.get(code) ?? []), resolve]);
    });
  };
  return { raw, fs, configuration, visual, diagnostics, waitForDiagnostic };
}

function waitForSnapshot(
  visual: VisualPresentationConfigurationController,
  predicate: (snapshot: VisualPresentationConfigurationSnapshot) => boolean,
): Promise<VisualPresentationConfigurationSnapshot> {
  const current = visual.getSnapshot();
  if (predicate(current)) return Promise.resolve(current);
  return new Promise((resolve) => {
    const unsubscribe = visual.subscribe((snapshot) => {
      if (!predicate(snapshot)) return;
      unsubscribe();
      resolve(snapshot);
    });
  });
}

describe("Visual presentation configuration schema", () => {
  test("keeps #620/#621 defaults and rejects arbitrary known values without rewriting unknown properties", () => {
    expect(DEFAULT_VISUAL_PRESENTATION_CONFIGURATION).toEqual({
      desktopLabels: { readability: "standard" },
      transparencyChecker: { intensity: "standard", pattern: "standard" },
    });

    const parsed = parseConfigurationDocument(JSON.stringify({
      schema: VISUAL_PRESENTATION_SCHEMA,
      version: VISUAL_PRESENTATION_SCHEMA_VERSION,
      desktopLabels: {
        readability: "url(javascript:alert(1))",
        futureLabelOption: "preserve-me",
      },
      transparencyChecker: {
        intensity: "strong",
        pattern: "coarse",
      },
      future: { retained: true },
    }), VISUAL_PRESENTATION_CONFIGURATION_DEFINITION);

    expect(parsed.accepted).toBe(true);
    expect(parsed.value).toEqual({
      desktopLabels: { readability: "standard" },
      transparencyChecker: { intensity: "strong", pattern: "coarse" },
    });
    expect(parsed.diagnostics.map((item) => item.code)).toEqual(["invalid-desktop-label-readability"]);
    expect(parsed.document?.future).toEqual({ retained: true });
    expect((parsed.document?.desktopLabels as Record<string, unknown>).futureLabelOption).toBe("preserve-me");
  });
});

describe("Visual presentation configuration filesystem lifecycle", () => {
  test("creates the canonical file and reloads valid Text-style writes live through one owner snapshot", async () => {
    const { fs, visual } = await fixture();
    try {
      const resource = await visual.resource();
      expect(await fs.pathOf(resource.id)).toBe(VISUAL_PRESENTATION_CONFIGURATION_PATH);
      expect(visual.getSnapshot()).toEqual(DEFAULT_VISUAL_PRESENTATION_CONFIGURATION);

      const nextSnapshot = waitForSnapshot(
        visual,
        (snapshot) => snapshot.desktopLabels.readability === "strong"
          && snapshot.transparencyChecker.intensity === "subtle"
          && snapshot.transparencyChecker.pattern === "fine",
      );
      const authored = JSON.stringify({
        schema: VISUAL_PRESENTATION_SCHEMA,
        version: VISUAL_PRESENTATION_SCHEMA_VERSION,
        desktopLabels: { readability: "strong" },
        transparencyChecker: { intensity: "subtle", pattern: "fine" },
        future: { retained: true },
      }, null, 2);
      await fs.write(resource.id, encoder.encode(`${authored}\n`), { truncate: true });

      expect(await nextSnapshot).toEqual({
        desktopLabels: { readability: "strong" },
        transparencyChecker: { intensity: "subtle", pattern: "fine" },
      });
      expect(JSON.parse(decoder.decode(await fs.read(resource.id))).future).toEqual({ retained: true });
    } finally {
      visual.dispose();
    }
  });

  test("keeps last-known-good for malformed warm edits, defaults cold, and rewrites only on explicit restore", async () => {
    const state = await fixture();
    const { fs, configuration, visual, waitForDiagnostic } = state;
    const resource = await visual.resource();
    try {
      const validSnapshot = waitForSnapshot(
        visual,
        (snapshot) => snapshot.desktopLabels.readability === "maximum",
      );
      await fs.write(resource.id, encoder.encode(JSON.stringify({
        schema: VISUAL_PRESENTATION_SCHEMA,
        version: VISUAL_PRESENTATION_SCHEMA_VERSION,
        desktopLabels: { readability: "maximum" },
        transparencyChecker: { intensity: "strong", pattern: "coarse" },
      })), { truncate: true });
      await validSnapshot;

      const malformedObserved = waitForDiagnostic("malformed-json");
      await fs.write(resource.id, encoder.encode("{broken"), { truncate: true });
      await malformedObserved;
      expect(visual.getSnapshot()).toEqual({
        desktopLabels: { readability: "maximum" },
        transparencyChecker: { intensity: "strong", pattern: "coarse" },
      });
      expect(decoder.decode(await fs.read(resource.id))).toBe("{broken");
    } finally {
      visual.dispose();
    }

    const cold = new VisualPresentationConfigurationController(fs, configuration);
    await cold.ready;
    try {
      expect(cold.getSnapshot()).toEqual(DEFAULT_VISUAL_PRESENTATION_CONFIGURATION);
      expect(decoder.decode(await fs.read(resource.id))).toBe("{broken");

      await cold.restoreDefaults();
      expect(cold.getSnapshot()).toEqual(DEFAULT_VISUAL_PRESENTATION_CONFIGURATION);
      const restored = JSON.parse(decoder.decode(await fs.read(resource.id)));
      expect(restored).toEqual({
        schema: VISUAL_PRESENTATION_SCHEMA,
        version: VISUAL_PRESENTATION_SCHEMA_VERSION,
        desktopLabels: { readability: "standard" },
        transparencyChecker: { intensity: "standard", pattern: "standard" },
      });
    } finally {
      cold.dispose();
    }
  });
});
