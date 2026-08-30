import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_CONFIGURATION_FORMAT = "plasmon-runtime-config-v1" as const;
export const RUNTIME_PREPARATION_FORMAT = "plasmon-runtime-preparation-v1" as const;
export const RUNTIME_HOST_CONTRACT = "plasmon.runtime-host.v1" as const;

export type RuntimeId = "js-dos" | "emulatorjs";
export type RuntimePackageTier = "slim" | "base";
export type RuntimeArchiveKind = "zip" | "tgz";

export interface RuntimeArtifactPin {
  readonly id: string;
  readonly url: string;
  readonly integrity: string;
  readonly archive: RuntimeArchiveKind;
  readonly maxBytes: number;
}

export interface OptionalRuntimeDefinition {
  readonly id: RuntimeId;
  readonly version: string;
  readonly upstream: string;
  readonly revision: string;
  readonly license: string;
  readonly compatibility: {
    readonly runtimeHostContract: typeof RUNTIME_HOST_CONTRACT;
    readonly plasmonReleaseSeries: "0.1";
  };
  readonly delivery: {
    readonly disposition: "prepared";
    readonly cacheAuthority: "content-addressed-preparation-cache";
    readonly materializationAuthority: "runtime-consumer";
    readonly offlineBehavior: "cache-required";
  };
  readonly sourceArtifacts: readonly RuntimeArtifactPin[];
  readonly requiredAssets: readonly string[];
  readonly contentDependencies: readonly string[];
}

/**
 * Runtime definitions are canonical Product/build metadata. A custom runtime
 * configuration selects from this catalog; it cannot replace pinned upstream
 * authority with an arbitrary URL.
 */
export const OPTIONAL_RUNTIME_CATALOG: Readonly<Record<RuntimeId, OptionalRuntimeDefinition>> = Object.freeze({
  "js-dos": Object.freeze({
    id: "js-dos",
    version: "8.4.1",
    upstream: "https://github.com/caiiiycuk/js-dos",
    revision: "v8.4.1",
    license: "GPL-2.0-or-later",
    compatibility: Object.freeze({
      runtimeHostContract: RUNTIME_HOST_CONTRACT,
      plasmonReleaseSeries: "0.1",
    }),
    delivery: Object.freeze({
      disposition: "prepared",
      cacheAuthority: "content-addressed-preparation-cache",
      materializationAuthority: "runtime-consumer",
      offlineBehavior: "cache-required",
    }),
    sourceArtifacts: Object.freeze([
      Object.freeze({
        id: "release",
        url: "https://github.com/caiiiycuk/js-dos/releases/download/v8.4.1/release.zip",
        integrity: "sha256-JhGGkruxgK7HjsFpfrHqayj/QQEBhwz6PmgwmRTH6qY=",
        archive: "zip",
        maxBytes: 32 * 1024 * 1024,
      }),
    ]),
    requiredAssets: Object.freeze([
      "js-dos.js",
      "js-dos.css",
      "emulators/emulators.js",
      "emulators/wdosbox.js",
      "emulators/wdosbox.wasm",
    ]),
    contentDependencies: Object.freeze([]),
  }),
  emulatorjs: Object.freeze({
    id: "emulatorjs",
    version: "4.2.3",
    upstream: "https://github.com/EmulatorJS/EmulatorJS",
    revision: "e150dc0491ae747028919fb82d6598954976ede6",
    license: "GPL-3.0",
    compatibility: Object.freeze({
      runtimeHostContract: RUNTIME_HOST_CONTRACT,
      plasmonReleaseSeries: "0.1",
    }),
    delivery: Object.freeze({
      disposition: "prepared",
      cacheAuthority: "content-addressed-preparation-cache",
      materializationAuthority: "runtime-consumer",
      offlineBehavior: "cache-required",
    }),
    sourceArtifacts: Object.freeze([
      Object.freeze({
        id: "emulatorjs",
        url: "https://registry.npmjs.org/@emulatorjs/emulatorjs/-/emulatorjs-4.2.3.tgz",
        integrity: "sha512-7z3qaA4LwyurhuGvdMUDF9xJpEbxC3SNy9+E9tSaOsRo8FCS2QXam/0k/lc9kqHWRFIlLKWahNjPAStyL0rFnw==",
        archive: "tgz",
        maxBytes: 16 * 1024 * 1024,
      }),
      Object.freeze({
        id: "fceumm-core",
        url: "https://registry.npmjs.org/@emulatorjs/core-fceumm/-/core-fceumm-4.2.3.tgz",
        integrity: "sha512-XX9Vv2N/hzp0TstNMCTSppEs+sg+1lpJpPdSDuRqIO/cwdt7dUcF+WjNX1yQJLRbP5+XwcNHZ6K4BKy8CJpndQ==",
        archive: "tgz",
        maxBytes: 16 * 1024 * 1024,
      }),
    ]),
    requiredAssets: Object.freeze([
      "loader.js",
      "emulator.min.js",
      "emulator.min.css",
      "compression/extract7z.js",
      "cores/fceumm-wasm.data",
      "cores/fceumm-legacy-wasm.data",
    ]),
    contentDependencies: Object.freeze([]),
  }),
});

export interface RuntimeConfigurationDocument {
  readonly format: typeof RUNTIME_CONFIGURATION_FORMAT;
  readonly id: string;
  readonly runtimes: readonly RuntimeId[];
}

export interface RuntimeSelectionContext {
  readonly packageTier: RuntimePackageTier;
  readonly demoOverlay: boolean;
}

export interface ResolvedRuntimeConfiguration {
  readonly configuration: RuntimeConfigurationDocument;
  readonly context: RuntimeSelectionContext;
  readonly runtimes: readonly OptionalRuntimeDefinition[];
}

export interface PreparedRuntimeArtifact {
  readonly runtimeId: RuntimeId;
  readonly runtimeVersion: string;
  readonly artifactId: string;
  readonly sourceUrl: string;
  readonly integrity: string;
  readonly archive: RuntimeArchiveKind;
  readonly bytes: number;
  readonly cachePath: string;
  readonly cacheHit: boolean;
}

export interface RuntimePreparationReport {
  readonly format: typeof RUNTIME_PREPARATION_FORMAT;
  readonly configurationId: string;
  readonly packageTier: RuntimePackageTier;
  readonly demoOverlay: boolean;
  readonly runtimeIds: readonly RuntimeId[];
  readonly artifacts: readonly PreparedRuntimeArtifact[];
  readonly totalArtifactBytes: number;
  readonly downloadedBytes: number;
  readonly reusedCacheBytes: number;
}

export type RuntimeCatalog = Readonly<Record<string, OptionalRuntimeDefinition>>;

const BUILTIN_CONFIGURATION_FILES = Object.freeze({
  none: "none.json",
  "demo-games": "demo-games.json",
});

const configurationDirectory = fileURLToPath(new URL("./runtime-configurations/", import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertClosedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${label} contains unknown field(s): ${unknown.sort().join(", ")}`);
  }
}

function parseIntegrity(integrity: string): { algorithm: "sha256" | "sha512"; expected: Uint8Array } {
  const match = /^(sha256|sha512)-([A-Za-z0-9+/]+={0,2})$/.exec(integrity);
  if (!match) throw new Error(`Unsupported or malformed integrity value: ${integrity}`);
  const algorithm = match[1] as "sha256" | "sha512";
  const expected = new Uint8Array(Buffer.from(match[2], "base64"));
  const expectedLength = algorithm === "sha256" ? 32 : 64;
  if (expected.byteLength !== expectedLength) {
    throw new Error(`Invalid ${algorithm} digest length in integrity value`);
  }
  return { algorithm, expected };
}

function digestHex(integrity: string): string {
  return Buffer.from(parseIntegrity(integrity).expected).toString("hex");
}

export function verifyRuntimeArtifactIntegrity(bytes: Uint8Array, pin: RuntimeArtifactPin): void {
  if (bytes.byteLength === 0) throw new Error(`Runtime artifact ${pin.id} is empty`);
  if (bytes.byteLength > pin.maxBytes) {
    throw new Error(`Runtime artifact ${pin.id} exceeds its ${pin.maxBytes}-byte limit`);
  }
  const { algorithm, expected } = parseIntegrity(pin.integrity);
  const actual = createHash(algorithm).update(bytes).digest();
  if (!actual.equals(Buffer.from(expected))) {
    throw new Error(`Integrity mismatch for runtime artifact ${pin.id}`);
  }
}

export function validateRuntimeCatalog(catalog: RuntimeCatalog = OPTIONAL_RUNTIME_CATALOG): void {
  const ids = Object.keys(catalog);
  if (ids.length === 0) throw new Error("Optional runtime catalog must not be empty");

  for (const [catalogId, definition] of Object.entries(catalog)) {
    if (definition.id !== catalogId) throw new Error(`Runtime catalog key ${catalogId} does not match definition id ${definition.id}`);
    if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) throw new Error(`Invalid runtime id: ${definition.id}`);
    if (!definition.version.trim()) throw new Error(`Runtime ${definition.id} is missing a version`);
    if (definition.compatibility.runtimeHostContract !== RUNTIME_HOST_CONTRACT) {
      throw new Error(`Runtime ${definition.id} requires incompatible host contract ${definition.compatibility.runtimeHostContract}`);
    }
    if (definition.compatibility.plasmonReleaseSeries !== "0.1") {
      throw new Error(`Runtime ${definition.id} is incompatible with Plasmon 0.1`);
    }
    if (definition.delivery.disposition !== "prepared") {
      throw new Error(`Runtime ${definition.id} uses unsupported delivery disposition ${definition.delivery.disposition}`);
    }
    if (definition.sourceArtifacts.length === 0) throw new Error(`Runtime ${definition.id} has no pinned source artifacts`);
    if (definition.requiredAssets.length === 0) throw new Error(`Runtime ${definition.id} has no required asset inventory`);

    const artifactIds = new Set<string>();
    for (const artifact of definition.sourceArtifacts) {
      if (!artifact.id.trim()) throw new Error(`Runtime ${definition.id} has an artifact without an id`);
      if (artifactIds.has(artifact.id)) throw new Error(`Runtime ${definition.id} repeats artifact id ${artifact.id}`);
      artifactIds.add(artifact.id);
      const url = new URL(artifact.url);
      if (url.protocol !== "https:") throw new Error(`Runtime ${definition.id} artifact ${artifact.id} must use HTTPS`);
      parseIntegrity(artifact.integrity);
      if (!Number.isSafeInteger(artifact.maxBytes) || artifact.maxBytes <= 0) {
        throw new Error(`Runtime ${definition.id} artifact ${artifact.id} has an invalid byte limit`);
      }
    }
  }
}

function normalizeRuntimeConfiguration(value: unknown, catalog: RuntimeCatalog): RuntimeConfigurationDocument {
  if (!isRecord(value)) throw new Error("Runtime configuration must be a JSON object");
  assertClosedKeys(value, ["format", "id", "runtimes"], "Runtime configuration");
  if (value.format !== RUNTIME_CONFIGURATION_FORMAT) {
    throw new Error(`Runtime configuration format must be ${RUNTIME_CONFIGURATION_FORMAT}`);
  }
  if (typeof value.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(value.id)) {
    throw new Error("Runtime configuration id must be a lowercase dash-separated identifier");
  }
  if (!Array.isArray(value.runtimes)) throw new Error("Runtime configuration runtimes must be an array");

  const runtimes: RuntimeId[] = [];
  const seen = new Set<string>();
  for (const runtimeId of value.runtimes) {
    if (typeof runtimeId !== "string") throw new Error("Runtime configuration runtime ids must be strings");
    if (seen.has(runtimeId)) throw new Error(`Runtime configuration repeats runtime id ${runtimeId}`);
    seen.add(runtimeId);
    if (!(runtimeId in catalog)) throw new Error(`Unknown optional runtime id: ${runtimeId}`);
    runtimes.push(runtimeId as RuntimeId);
  }

  return Object.freeze({
    format: RUNTIME_CONFIGURATION_FORMAT,
    id: value.id,
    runtimes: Object.freeze(runtimes),
  });
}

async function readConfigurationFile(path: string, catalog: RuntimeCatalog): Promise<RuntimeConfigurationDocument> {
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Unable to read runtime configuration ${path}`, { cause: error });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Malformed runtime configuration JSON in ${path}`, { cause: error });
  }
  return normalizeRuntimeConfiguration(parsed, catalog);
}

export async function loadRuntimeConfiguration(
  selection = "none",
  catalog: RuntimeCatalog = OPTIONAL_RUNTIME_CATALOG,
): Promise<RuntimeConfigurationDocument> {
  validateRuntimeCatalog(catalog);
  const builtin = BUILTIN_CONFIGURATION_FILES[selection as keyof typeof BUILTIN_CONFIGURATION_FILES];
  if (builtin) return readConfigurationFile(join(configurationDirectory, builtin), catalog);

  if (!selection.includes("/") && !selection.includes("\\") && !selection.endsWith(".json")) {
    throw new Error(
      `Unknown built-in runtime configuration "${selection}". Expected one of: ${Object.keys(BUILTIN_CONFIGURATION_FILES).join(", ")}, or a JSON file path.`,
    );
  }
  return readConfigurationFile(resolve(selection), catalog);
}

export async function resolveRuntimeConfiguration(
  selection: string | undefined,
  context: RuntimeSelectionContext,
  catalog: RuntimeCatalog = OPTIONAL_RUNTIME_CATALOG,
): Promise<ResolvedRuntimeConfiguration> {
  if (context.packageTier !== "slim" && context.packageTier !== "base") {
    throw new Error(`Unsupported package tier for runtime configuration: ${String(context.packageTier)}`);
  }
  const configuration = await loadRuntimeConfiguration(selection ?? "none", catalog);
  if (context.packageTier === "slim" && configuration.runtimes.length > 0) {
    throw new Error(
      `Slim cannot select optional runtimes (${configuration.runtimes.join(", ")}); use Base/Demo preparation instead.`,
    );
  }
  const runtimes = configuration.runtimes.map((id) => catalog[id]);
  return Object.freeze({
    configuration,
    context: Object.freeze({ ...context }),
    runtimes: Object.freeze(runtimes),
  });
}

async function readBoundedResponse(response: Response, pin: RuntimeArtifactPin): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (Number.isFinite(parsed) && parsed > pin.maxBytes) {
      throw new Error(`Runtime artifact ${pin.id} declares ${parsed} bytes, above its ${pin.maxBytes}-byte limit`);
    }
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > pin.maxBytes) throw new Error(`Runtime artifact ${pin.id} exceeds its byte limit`);
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > pin.maxBytes) {
      await reader.cancel();
      throw new Error(`Runtime artifact ${pin.id} exceeds its ${pin.maxBytes}-byte limit`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function cachePathFor(cacheRoot: string, pin: RuntimeArtifactPin): string {
  const { algorithm } = parseIntegrity(pin.integrity);
  return join(resolve(cacheRoot), algorithm, digestHex(pin.integrity), `payload.${pin.archive}`);
}

async function acquireArtifact(
  runtime: OptionalRuntimeDefinition,
  pin: RuntimeArtifactPin,
  options: {
    readonly cacheRoot: string;
    readonly offline: boolean;
    readonly fetcher: typeof fetch;
  },
): Promise<PreparedRuntimeArtifact> {
  const cachePath = cachePathFor(options.cacheRoot, pin);
  try {
    const cached = new Uint8Array(await readFile(cachePath));
    verifyRuntimeArtifactIntegrity(cached, pin);
    return Object.freeze({
      runtimeId: runtime.id,
      runtimeVersion: runtime.version,
      artifactId: pin.id,
      sourceUrl: pin.url,
      integrity: pin.integrity,
      archive: pin.archive,
      bytes: cached.byteLength,
      cachePath,
      cacheHit: true,
    });
  } catch (error) {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : undefined;
    if (code !== "ENOENT") {
      throw new Error(`Cached runtime artifact ${runtime.id}/${pin.id} failed integrity validation at ${cachePath}`, { cause: error });
    }
  }

  if (options.offline) {
    throw new Error(`Offline runtime preparation requires cached artifact ${runtime.id}/${pin.id} at ${cachePath}`);
  }

  const response = await options.fetcher(pin.url, {
    method: "GET",
    redirect: "follow",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`Runtime artifact ${runtime.id}/${pin.id} fetch failed with HTTP ${response.status}`);
  const bytes = await readBoundedResponse(response, pin);
  verifyRuntimeArtifactIntegrity(bytes, pin);

  await mkdir(dirname(cachePath), { recursive: true });
  const temporary = `${cachePath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  await writeFile(temporary, bytes);
  await rename(temporary, cachePath);

  return Object.freeze({
    runtimeId: runtime.id,
    runtimeVersion: runtime.version,
    artifactId: pin.id,
    sourceUrl: pin.url,
    integrity: pin.integrity,
    archive: pin.archive,
    bytes: bytes.byteLength,
    cachePath,
    cacheHit: false,
  });
}

export async function prepareRuntimeConfiguration(
  resolved: ResolvedRuntimeConfiguration,
  options: {
    readonly cacheRoot: string;
    readonly offline?: boolean;
    readonly fetcher?: typeof fetch;
  },
): Promise<RuntimePreparationReport> {
  const fetcher = options.fetcher ?? fetch;
  const artifacts: PreparedRuntimeArtifact[] = [];
  for (const runtime of resolved.runtimes) {
    for (const pin of runtime.sourceArtifacts) {
      artifacts.push(await acquireArtifact(runtime, pin, {
        cacheRoot: options.cacheRoot,
        offline: options.offline ?? false,
        fetcher,
      }));
    }
  }

  const totalArtifactBytes = artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
  const downloadedBytes = artifacts.filter((artifact) => !artifact.cacheHit).reduce((total, artifact) => total + artifact.bytes, 0);
  const reusedCacheBytes = totalArtifactBytes - downloadedBytes;
  return Object.freeze({
    format: RUNTIME_PREPARATION_FORMAT,
    configurationId: resolved.configuration.id,
    packageTier: resolved.context.packageTier,
    demoOverlay: resolved.context.demoOverlay,
    runtimeIds: Object.freeze(resolved.configuration.runtimes.slice()),
    artifacts: Object.freeze(artifacts),
    totalArtifactBytes,
    downloadedBytes,
    reusedCacheBytes,
  });
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

async function runCli(args: readonly string[]): Promise<void> {
  const action = args[0] ?? "resolve";
  if (action !== "resolve" && action !== "prepare") throw new Error(`Unknown runtime configuration action: ${action}`);
  const selection = argumentValue(args, "--config") ?? process.env.PLASMON_RUNTIME_CONFIGURATION ?? "none";
  const packageTier = (argumentValue(args, "--tier") ?? "base") as RuntimePackageTier;
  const demoOverlay = args.includes("--demo-overlay");
  const resolved = await resolveRuntimeConfiguration(selection, { packageTier, demoOverlay });

  if (action === "resolve") {
    process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    return;
  }

  const cacheRoot = argumentValue(args, "--cache") ?? ".plasmon/runtime-cache";
  const report = await prepareRuntimeConfiguration(resolved, {
    cacheRoot,
    offline: args.includes("--offline"),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.main) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Runtime configuration failed: ${message}\n`);
    process.exitCode = 1;
  });
}
