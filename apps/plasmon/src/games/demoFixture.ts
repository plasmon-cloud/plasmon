import type { FilesystemSeedSpec } from "../os/fs/index.ts";
import {
  DEMO_GAME_MIME,
  DEMO_GAME_RESOURCE_NAME,
  PACKAGED_DEMO_GAME_FILENAME,
} from "./demoFixtureBundle.ts";

export const DEMO_GAME_FIXTURE_PARAM = "plasmon-fixture";
export const DEMO_GAME_FIXTURE_VALUE = "demo-game";
export const DEMO_GAME_FIXTURE_SEED_KEY = "games.demo.plasmon-v1";
export const DEMO_GAME_FIXTURE_PATH = `/Games/${DEMO_GAME_RESOURCE_NAME}`;
export const DEMO_GAME_PACKAGE_ASSET = `./fixtures/${PACKAGED_DEMO_GAME_FILENAME}`;

export type FixtureFetch = (input: string | URL) => Promise<Response>;

/** Normal boot never requests demo content; only the exact opt-in flag enables it. */
export function packagedDemoGameRequested(pageUrl: string | URL): boolean {
  return new URL(pageUrl).searchParams.get(DEMO_GAME_FIXTURE_PARAM) === DEMO_GAME_FIXTURE_VALUE;
}

/**
 * Loads the package-owned bytes only when explicitly requested and expresses
 * them through the existing filesystem demo-seed authority. The returned file
 * is still an ordinary /Games resource; opening policy remains untouched.
 */
export async function loadPackagedDemoGameSeeds(
  pageUrl: string | URL,
  fetchAsset: FixtureFetch = (input) => fetch(input),
): Promise<readonly FilesystemSeedSpec[]> {
  const resolvedPageUrl = new URL(pageUrl);
  if (!packagedDemoGameRequested(resolvedPageUrl)) return [];

  const assetUrl = new URL(DEMO_GAME_PACKAGE_ASSET, resolvedPageUrl);
  const response = await fetchAsset(assetUrl);
  if (!response.ok) {
    throw new Error(`Packaged demo-game fixture is unavailable (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Packaged demo-game fixture is empty");

  return [{
    key: DEMO_GAME_FIXTURE_SEED_KEY,
    seedClass: "demo-temporary",
    parentPath: "/Games",
    name: DEMO_GAME_RESOURCE_NAME,
    kind: "file",
    mime: DEMO_GAME_MIME,
    bytes,
  }];
}
