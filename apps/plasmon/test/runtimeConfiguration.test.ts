import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  OPTIONAL_RUNTIME_CATALOG,
  RUNTIME_CONFIGURATION_FORMAT,
  RUNTIME_HOST_CONTRACT,
  loadRuntimeConfiguration,
  prepareRuntimeConfiguration,
  resolveRuntimeConfiguration,
  validateRuntimeCatalog,
  verifyRuntimeArtifactIntegrity,
  type OptionalRuntimeDefinition,
  type RuntimeCatalog,
} from "../runtimeConfiguration.ts";

async function withTempDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "plasmon-runtime-config-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeConfiguration(directory: string, id: string, runtimes: readonly string[]): Promise<string> {
  const path = join(directory, `${id}.json`);
  await writeFile(path, `${JSON.stringify({
    format: RUNTIME_CONFIGURATION_FORMAT,
    id,
    runtimes,
  }, null, 2)}\n`);
  return path;
}

function sri(algorithm: "sha256" | "sha512", bytes: Uint8Array): string {
  return `${algorithm}-${createHash(algorithm).update(bytes).digest("base64")}`;
}

function catalogWith(definition: OptionalRuntimeDefinition): RuntimeCatalog {
  return Object.freeze({ [definition.id]: definition });
}

describe("runtime configuration authority", () => {
  test("built-in selections use one canonical catalog", async () => {
    validateRuntimeCatalog();
    const none = await loadRuntimeConfiguration("none");
    const demo = await loadRuntimeConfiguration("demo-games");

    expect(none).toEqual({
      format: RUNTIME_CONFIGURATION_FORMAT,
      id: "none",
      runtimes: [],
    });
    expect(demo.runtimes).toEqual(["js-dos", "emulatorjs"]);
    expect(OPTIONAL_RUNTIME_CATALOG["js-dos"]).toMatchObject({
      id: "js-dos",
      version: "8.4.1",
      delivery: { disposition: "prepared" },
      compatibility: { runtimeHostContract: RUNTIME_HOST_CONTRACT },
    });
    expect(OPTIONAL_RUNTIME_CATALOG.emulatorjs).toMatchObject({
      id: "emulatorjs",
      version: "4.2.3",
      delivery: { disposition: "prepared" },
      compatibility: { runtimeHostContract: RUNTIME_HOST_CONTRACT },
    });
  });

  test("custom configuration selects a supported subset without source changes", async () => {
    await withTempDirectory(async (directory) => {
      const path = await writeConfiguration(directory, "custom-dos", ["js-dos"]);
      const resolved = await resolveRuntimeConfiguration(path, {
        packageTier: "base",
        demoOverlay: false,
      });

      expect(resolved.configuration.id).toBe("custom-dos");
      expect(resolved.configuration.runtimes).toEqual(["js-dos"]);
      expect(resolved.runtimes.map((runtime) => runtime.id)).toEqual(["js-dos"]);
      expect(resolved.context).toEqual({ packageTier: "base", demoOverlay: false });
    });
  });

  test("package tier, Demo overlay, and runtime selection remain separate dimensions", async () => {
    const base = await resolveRuntimeConfiguration("demo-games", {
      packageTier: "base",
      demoOverlay: false,
    });
    const demo = await resolveRuntimeConfiguration("demo-games", {
      packageTier: "base",
      demoOverlay: true,
    });

    expect(base.configuration.runtimes).toEqual(demo.configuration.runtimes);
    expect(base.context.demoOverlay).toBeFalse();
    expect(demo.context.demoOverlay).toBeTrue();
    await expect(resolveRuntimeConfiguration("demo-games", {
      packageTier: "slim",
      demoOverlay: false,
    })).rejects.toThrow("Slim cannot select optional runtimes");
    expect((await resolveRuntimeConfiguration("none", {
      packageTier: "slim",
      demoOverlay: false,
    })).configuration.runtimes).toEqual([]);
  });

  test("unknown runtime ids and unknown built-ins fail closed with actionable identity", async () => {
    await expect(loadRuntimeConfiguration("not-a-config")).rejects.toThrow(
      "Unknown built-in runtime configuration \"not-a-config\"",
    );
    await withTempDirectory(async (directory) => {
      const path = await writeConfiguration(directory, "bad-runtime", ["unknown-runtime"]);
      await expect(loadRuntimeConfiguration(path)).rejects.toThrow("Unknown optional runtime id: unknown-runtime");

      for (const inheritedRuntimeId of ["toString", "__proto__"] as const) {
        const inheritedPath = await writeConfiguration(directory, `bad-${inheritedRuntimeId.toLowerCase()}`, [inheritedRuntimeId]);
        await expect(loadRuntimeConfiguration(inheritedPath)).rejects.toThrow(
          `Unknown optional runtime id: ${inheritedRuntimeId}`,
        );
      }
    });
  });

  test("malformed and open-ended configuration shapes fail closed", async () => {
    await withTempDirectory(async (directory) => {
      const malformed = join(directory, "malformed.json");
      await writeFile(malformed, "{ nope");
      await expect(loadRuntimeConfiguration(malformed)).rejects.toThrow("Malformed runtime configuration JSON");

      const unknownField = join(directory, "unknown-field.json");
      await writeFile(unknownField, JSON.stringify({
        format: RUNTIME_CONFIGURATION_FORMAT,
        id: "unknown-field",
        runtimes: [],
        source: "https://example.invalid/runtime.zip",
      }));
      await expect(loadRuntimeConfiguration(unknownField)).rejects.toThrow("unknown field(s): source");
    });
  });

  test("runtime definitions require version, compatible host contract, source pins, and integrity", () => {
    const original = OPTIONAL_RUNTIME_CATALOG["js-dos"];

    expect(() => validateRuntimeCatalog(catalogWith({ ...original, version: "" }))).toThrow("missing a version");
    expect(() => validateRuntimeCatalog(catalogWith({
      ...original,
      compatibility: {
        ...original.compatibility,
        runtimeHostContract: "plasmon.runtime-host.v2" as typeof RUNTIME_HOST_CONTRACT,
      },
    }))).toThrow("incompatible host contract");
    expect(() => validateRuntimeCatalog(catalogWith({ ...original, sourceArtifacts: [] }))).toThrow("no pinned source artifacts");
    expect(() => validateRuntimeCatalog(catalogWith({
      ...original,
      sourceArtifacts: [{ ...original.sourceArtifacts[0], integrity: "" }],
    }))).toThrow("Unsupported or malformed integrity value");
  });

  test("integrity verification rejects modified runtime bytes", () => {
    const bytes = new TextEncoder().encode("accepted runtime bytes");
    const pin = {
      id: "fixture",
      url: "https://example.invalid/runtime.zip",
      integrity: sri("sha256", bytes),
      archive: "zip" as const,
      maxBytes: 1024,
    };
    expect(() => verifyRuntimeArtifactIntegrity(bytes, pin)).not.toThrow();
    expect(() => verifyRuntimeArtifactIntegrity(new TextEncoder().encode("modified runtime bytes"), pin)).toThrow(
      "Integrity mismatch for runtime artifact fixture",
    );
  });

  test("preparation downloads only selected pins, then supports verified offline cache reuse", async () => {
    await withTempDirectory(async (directory) => {
      const bytes = new TextEncoder().encode("small pinned runtime archive");
      const definition: OptionalRuntimeDefinition = {
        ...OPTIONAL_RUNTIME_CATALOG["js-dos"],
        sourceArtifacts: [{
          id: "fixture",
          url: "https://example.invalid/runtime.zip",
          integrity: sri("sha256", bytes),
          archive: "zip",
          maxBytes: 1024,
        }],
      };
      const catalog = catalogWith(definition);
      const configPath = await writeConfiguration(directory, "fixture-runtime", ["js-dos"]);
      const resolved = await resolveRuntimeConfiguration(configPath, {
        packageTier: "base",
        demoOverlay: true,
      }, catalog);
      let fetchCount = 0;
      const fetcher = (async () => {
        fetchCount += 1;
        return new Response(bytes, {
          status: 200,
          headers: { "content-length": String(bytes.byteLength) },
        });
      }) as typeof fetch;
      const cacheRoot = join(directory, "cache");

      const first = await prepareRuntimeConfiguration(resolved, { cacheRoot, fetcher });
      expect(fetchCount).toBe(1);
      expect(first).toMatchObject({
        configurationId: "fixture-runtime",
        packageTier: "base",
        demoOverlay: true,
        runtimeIds: ["js-dos"],
        totalArtifactBytes: bytes.byteLength,
        downloadedBytes: bytes.byteLength,
        reusedCacheBytes: 0,
      });
      expect(first.artifacts[0].cacheHit).toBeFalse();
      expect(new Uint8Array(await readFile(first.artifacts[0].cachePath))).toEqual(bytes);

      const second = await prepareRuntimeConfiguration(resolved, {
        cacheRoot,
        offline: true,
        fetcher: (async () => {
          throw new Error("offline preparation must not fetch");
        }) as typeof fetch,
      });
      expect(fetchCount).toBe(1);
      expect(second.downloadedBytes).toBe(0);
      expect(second.reusedCacheBytes).toBe(bytes.byteLength);
      expect(second.artifacts[0].cacheHit).toBeTrue();
    });
  });

  test("offline preparation fails closed when a selected artifact is not cached", async () => {
    await withTempDirectory(async (directory) => {
      const bytes = new TextEncoder().encode("missing cached runtime archive");
      const definition: OptionalRuntimeDefinition = {
        ...OPTIONAL_RUNTIME_CATALOG["js-dos"],
        sourceArtifacts: [{
          id: "missing",
          url: "https://example.invalid/runtime.zip",
          integrity: sri("sha256", bytes),
          archive: "zip",
          maxBytes: 1024,
        }],
      };
      const catalog = catalogWith(definition);
      const configPath = await writeConfiguration(directory, "offline-missing", ["js-dos"]);
      const resolved = await resolveRuntimeConfiguration(configPath, {
        packageTier: "base",
        demoOverlay: false,
      }, catalog);

      await expect(prepareRuntimeConfiguration(resolved, {
        cacheRoot: join(directory, "cache"),
        offline: true,
      })).rejects.toThrow("Offline runtime preparation requires cached artifact js-dos/missing");
    });
  });
});
