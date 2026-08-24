import { expect, test } from "bun:test";
import { MemoryFsRepository, PersistentFsService } from "./fs/index.ts";
import {
  canLoadImageThumbnail,
  imageThumbnailMime,
  loadImageThumbnail,
  MAX_IMAGE_THUMBNAIL_BYTES,
  type ThumbnailObjectUrlApi,
} from "./resource-thumbnail.ts";

test("#426 resource thumbnails use canonical image classification without a private suffix table", async () => {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("test filesystem root unavailable");
  const created = await fs.createFile(root.id, "photo.png");
  await fs.write(created.id, Uint8Array.from([137, 80, 78, 71]), { truncate: true });
  const node = await fs.stat(created.id);

  expect(imageThumbnailMime(node)).toBe("image/png");
  expect(canLoadImageThumbnail(node)).toBe(true);

  const blobs: Blob[] = [];
  const revoked: string[] = [];
  const urlApi: ThumbnailObjectUrlApi = {
    createObjectURL(blob) {
      blobs.push(blob);
      return "blob:canonical-image";
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
  const loaded = await loadImageThumbnail(fs, node, urlApi);
  expect(loaded?.url).toBe("blob:canonical-image");
  expect(blobs[0]?.type).toBe("image/png");
  loaded?.revoke();
  loaded?.revoke();
  expect(revoked).toEqual(["blob:canonical-image"]);
});

test("#426 direct image thumbnails retain the bounded byte guard", () => {
  const node = {
    id: "oversize-image",
    parentId: "root",
    name: "large.jpg",
    kind: "file" as const,
    mime: "image/jpeg",
    size: MAX_IMAGE_THUMBNAIL_BYTES + 1,
    createdAt: 0,
    modifiedAt: 0,
    contentHash: null,
    metadata: {},
  };
  expect(canLoadImageThumbnail(node)).toBe(false);
});
