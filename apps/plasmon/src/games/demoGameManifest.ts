import type { RuntimeId } from "../../runtimeConfiguration.ts";
import {
  DEMO_NES_BYTES,
  DEMO_NES_LICENSE_NAME,
  DEMO_NES_RESOURCE_NAME,
  DEMO_NES_SHA256,
} from "./demoNesContract.ts";

export const DEMO_GAME_MANIFEST_FORMAT = "plasmon-demo-games-v1" as const;

export type DemoGameDisposition = "bundled" | "on-demand/prepared" | "test-only";

export interface DemoGameManifestEntry {
  readonly id: string;
  readonly filesystemPath: string;
  readonly expectedRuntime: RuntimeId;
  readonly source: {
    readonly location: string;
    readonly pin: string;
    readonly digest: string;
  };
  readonly redistribution: {
    readonly license: string;
    readonly basis: string;
    readonly attributionPath: string;
  };
  readonly measuredBytes: number;
  readonly disposition: DemoGameDisposition;
}

export interface DemoGameManifest {
  readonly format: typeof DEMO_GAME_MANIFEST_FORMAT;
  readonly entries: readonly DemoGameManifestEntry[];
}

export interface DemoGameManifestValidationOptions {
  readonly knownRuntimeIds: ReadonlySet<string>;
  readonly selectedRuntimeIds?: ReadonlySet<string>;
}

/**
 * Small legal Demo content manifest. Both supplied titles are generated from
 * repository-owned source; runtime definitions remain owned by the canonical
 * optional-runtime configuration and runtime consumers. The EmulatorJS
 * acceptance ROM remains test-only and is absent.
 */
export const DEMO_GAME_MANIFEST: DemoGameManifest = Object.freeze({
  format: DEMO_GAME_MANIFEST_FORMAT,
  entries: Object.freeze([
    Object.freeze({
      id: "plasmon-demo-jsdos",
      filesystemPath: "/Games/Plasmon Demo.jsdos",
      expectedRuntime: "js-dos",
      source: Object.freeze({
        location: "apps/plasmon/src/games/demoFixtureBundle.ts",
        pin: "git-blob:2da47f36d35283ff8f5af919b4fc74defe15f168",
        digest: "sha256-vxzzAYONbWOsS46VRQ2l0Rz4M7dW6AnA/L1JNYQ+WbA=",
      }),
      redistribution: Object.freeze({
        license: "GPL-3.0-only",
        basis: "Repository-authored Plasmon demo program and deterministic package contents",
        attributionPath: "/Games/Plasmon Demo.jsdos#README.TXT",
      }),
      measuredBytes: 1056,
      disposition: "bundled",
    }),
    Object.freeze({
      id: "plasmon-demo-nes",
      filesystemPath: `/Games/${DEMO_NES_RESOURCE_NAME}`,
      expectedRuntime: "emulatorjs",
      source: Object.freeze({
        location: "apps/plasmon/src/games/demoNesBundle.ts",
        pin: "git-blob:3174446a0b612454c3548888d02c019b894bf36b",
        digest: DEMO_NES_SHA256,
      }),
      redistribution: Object.freeze({
        license: "GPL-3.0-only",
        basis: "Repository-authored interactive NES/NROM homebrew generated deterministically from Plasmon source",
        attributionPath: `/Games/${DEMO_NES_LICENSE_NAME}`,
      }),
      measuredBytes: DEMO_NES_BYTES,
      disposition: "bundled",
    }),
  ]),
});

function requireText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`Demo game manifest entry is missing ${label}`);
}

function validateDigest(value: string, label: string): void {
  requireText(value, label);
  if (!/^sha256-[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw new Error(`Demo game manifest ${label} must be a SHA-256 SRI digest`);
  }
}

/**
 * Demo game metadata is content authority only. Runtime compatibility is
 * cross-checked against the canonical optional-runtime selection supplied by
 * the build; the manifest never creates a parallel runtime registry.
 */
export function validateDemoGameManifest(
  manifest: DemoGameManifest,
  options: DemoGameManifestValidationOptions,
): void {
  if (manifest.format !== DEMO_GAME_MANIFEST_FORMAT) {
    throw new Error(`Demo game manifest format must be ${DEMO_GAME_MANIFEST_FORMAT}`);
  }

  const destinations = new Set<string>();
  const ids = new Set<string>();
  for (const entry of manifest.entries) {
    requireText(entry.id, "id");
    if (ids.has(entry.id)) throw new Error(`Demo game manifest repeats id ${entry.id}`);
    ids.add(entry.id);

    requireText(entry.filesystemPath, `${entry.id} filesystem path`);
    if (!entry.filesystemPath.startsWith("/Games/") || entry.filesystemPath.includes("/../")) {
      throw new Error(`Demo game ${entry.id} must use a normalized /Games destination`);
    }
    if (destinations.has(entry.filesystemPath)) {
      throw new Error(`Demo game manifest repeats destination ${entry.filesystemPath}`);
    }
    destinations.add(entry.filesystemPath);

    if (!options.knownRuntimeIds.has(entry.expectedRuntime)) {
      throw new Error(`Demo game ${entry.id} references unknown runtime ${entry.expectedRuntime}`);
    }
    if (options.selectedRuntimeIds && !options.selectedRuntimeIds.has(entry.expectedRuntime)) {
      throw new Error(`Demo game ${entry.id} requires unselected runtime ${entry.expectedRuntime}`);
    }

    requireText(entry.source.location, `${entry.id} source location`);
    requireText(entry.source.pin, `${entry.id} source pin`);
    validateDigest(entry.source.digest, `${entry.id} source digest`);
    requireText(entry.redistribution.license, `${entry.id} license`);
    requireText(entry.redistribution.basis, `${entry.id} redistribution basis`);
    requireText(entry.redistribution.attributionPath, `${entry.id} attribution path`);

    if (!Number.isSafeInteger(entry.measuredBytes) || entry.measuredBytes <= 0) {
      throw new Error(`Demo game ${entry.id} must record positive measured bytes`);
    }
    if (!["bundled", "on-demand/prepared", "test-only"].includes(entry.disposition)) {
      throw new Error(`Demo game ${entry.id} has unsupported disposition ${String(entry.disposition)}`);
    }
  }
}
