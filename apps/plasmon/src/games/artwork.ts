import type { FsService } from "../os/contracts/index.ts";
import {
  readResourceArtworkMetadata,
  resourceArtworkMetadata,
} from "../os/fs/index.ts";
import { DEMO_GAME_FIXTURE_PATH } from "./demoFixture.ts";

export const PACKAGED_DEMO_GAME_ARTWORK_SRC = "static/plasmon/artwork/plasmon-demo.svg";
export const PACKAGED_DEMO_GAME_ARTWORK_MIME = "image/svg+xml" as const;
export const PACKAGED_DEMO_GAME_ARTWORK_BYTES = 1193;

/**
 * Fixture-owned metadata reconciliation only. The filesystem metadata contract
 * is generic; Games does not render, resolve, or execute artwork.
 */
export async function reconcilePackagedDemoGameArtwork(fs: FsService): Promise<boolean> {
  const node = await fs.resolvePath(DEMO_GAME_FIXTURE_PATH);
  if (!node || node.kind !== "file") return false;

  const current = readResourceArtworkMetadata(node);
  if (current
    && current.src === PACKAGED_DEMO_GAME_ARTWORK_SRC
    && current.mime === PACKAGED_DEMO_GAME_ARTWORK_MIME
    && current.byteSize === PACKAGED_DEMO_GAME_ARTWORK_BYTES) return false;

  await fs.setMetadata(node.id, resourceArtworkMetadata({
    src: PACKAGED_DEMO_GAME_ARTWORK_SRC,
    mime: PACKAGED_DEMO_GAME_ARTWORK_MIME,
    byteSize: PACKAGED_DEMO_GAME_ARTWORK_BYTES,
  }));
  return true;
}
