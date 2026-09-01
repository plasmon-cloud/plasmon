import type { FilesystemSeedSpec } from "../os/fs/index.ts";
import {
  DEMO_GAME_MIME,
  DEMO_GAME_RESOURCE_NAME,
  PACKAGED_DEMO_GAME_FILENAME,
} from "./demoFixtureContract.ts";
import {
  DEMO_NES_LICENSE_NAME,
  DEMO_NES_LICENSE_TEXT,
  DEMO_NES_MIME,
  DEMO_NES_RESOURCE_NAME,
  PACKAGED_DEMO_NES_FILENAME,
} from "./demoNesContract.ts";

export const DEMO_GAME_FIXTURE_PARAM = "plasmon-fixture";
export const DEMO_GAME_FIXTURE_VALUE = "demo-game";
export const DEMO_GAME_FIXTURE_SEED_KEY = "games.demo.plasmon-v1";
export const DEMO_GAME_FIXTURE_PATH = `/Games/${DEMO_GAME_RESOURCE_NAME}`;
export const DEMO_GAME_PACKAGE_ASSET = `./fixtures/${PACKAGED_DEMO_GAME_FILENAME}`;
export const DEMO_NES_SEED_KEY = "games.demo.plasmon-nes-v1";
export const DEMO_NES_PATH = `/Games/${DEMO_NES_RESOURCE_NAME}`;
export const DEMO_NES_LICENSE_PATH = `/Games/${DEMO_NES_LICENSE_NAME}`;
export const DEMO_NES_PACKAGE_ASSET = `./fixtures/${PACKAGED_DEMO_NES_FILENAME}`;

export type FixtureFetch = (input: string | URL) => Promise<Response>;

/** Normal Base boot never requests demo content; only Demo/explicit fixture paths call the loader. */
export function packagedDemoGameRequested(pageUrl: string | URL): boolean {
  return new URL(pageUrl).searchParams.get(DEMO_GAME_FIXTURE_PARAM) === DEMO_GAME_FIXTURE_VALUE;
}

async function fetchRequiredBytes(
  pageUrl: string | URL,
  asset: string,
  label: string,
  fetchAsset: FixtureFetch,
): Promise<Uint8Array> {
  const response = await fetchAsset(new URL(asset, new URL(pageUrl)));
  if (!response.ok) throw new Error(`${label} is unavailable (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error(`${label} is empty`);
  return bytes;
}

/** Load the exact package-owned js-dos Demo game as an ordinary filesystem seed. */
export async function loadPackagedDemoGameSeed(
  pageUrl: string | URL,
  fetchAsset: FixtureFetch = (input) => fetch(input),
): Promise<FilesystemSeedSpec> {
  const bytes = await fetchRequiredBytes(
    pageUrl,
    DEMO_GAME_PACKAGE_ASSET,
    "Packaged js-dos Demo game",
    fetchAsset,
  );
  return {
    key: DEMO_GAME_FIXTURE_SEED_KEY,
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: DEMO_GAME_RESOURCE_NAME,
    kind: "file",
    mime: DEMO_GAME_MIME,
    bytes,
  };
}

/** Load the repository-authored NES Demo homebrew from the Demo-only package asset. */
export async function loadPackagedDemoNesSeed(
  pageUrl: string | URL,
  fetchAsset: FixtureFetch = (input) => fetch(input),
): Promise<FilesystemSeedSpec> {
  const bytes = await fetchRequiredBytes(
    pageUrl,
    DEMO_NES_PACKAGE_ASSET,
    "Packaged NES Demo game",
    fetchAsset,
  );
  if (
    bytes.length < 16
    || bytes[0] !== 0x4e
    || bytes[1] !== 0x45
    || bytes[2] !== 0x53
    || bytes[3] !== 0x1a
  ) {
    throw new Error("Packaged NES Demo game is not a valid iNES resource");
  }
  return {
    key: DEMO_NES_SEED_KEY,
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: DEMO_NES_RESOURCE_NAME,
    kind: "file",
    mime: DEMO_NES_MIME,
    bytes,
  };
}

export function createDemoNesLicenseSeed(): FilesystemSeedSpec {
  return {
    key: "games.demo.plasmon-nes-license-v1",
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: DEMO_NES_LICENSE_NAME,
    kind: "file",
    mime: "text/plain",
    bytes: new TextEncoder().encode(DEMO_NES_LICENSE_TEXT),
  };
}

/** Canonical Demo product content: one js-dos title, one NES homebrew, and its attribution. */
export async function loadPackagedProductDemoGameSeeds(
  pageUrl: string | URL,
  fetchAsset: FixtureFetch = (input) => fetch(input),
): Promise<readonly FilesystemSeedSpec[]> {
  const [jsDos, nes] = await Promise.all([
    loadPackagedDemoGameSeed(pageUrl, fetchAsset),
    loadPackagedDemoNesSeed(pageUrl, fetchAsset),
  ]);
  return [jsDos, nes, createDemoNesLicenseSeed()];
}

/**
 * Compatibility seam for Specialist js-dos acceptance. The explicit fixture
 * query remains js-dos-only; normal Base boot never calls this path.
 */
export async function loadPackagedDemoGameSeeds(
  pageUrl: string | URL,
  fetchAsset: FixtureFetch = (input) => fetch(input),
): Promise<readonly FilesystemSeedSpec[]> {
  const resolvedPageUrl = new URL(pageUrl);
  if (!packagedDemoGameRequested(resolvedPageUrl)) return [];
  return [await loadPackagedDemoGameSeed(resolvedPageUrl, fetchAsset)];
}
