import { expect, test } from "bun:test";
import type { FsNode } from "./contracts/index.ts";
import { MemoryFsRepository, PersistentFsService } from "./fs/index.ts";
import {
  canLoadImageThumbnail,
  canLoadVideoThumbnail,
  createVideoThumbnailCleanup,
  imageThumbnailMime,
  loadImageThumbnail,
  loadResourceThumbnail,
  MAX_IMAGE_THUMBNAIL_BYTES,
  MAX_VIDEO_THUMBNAIL_BYTES,
  representativeVideoFrameTime,
  videoThumbnailDimensions,
  videoThumbnailMime,
  type ThumbnailObjectUrlApi,
} from "./resource-thumbnail.ts";

async function createImage() {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("test filesystem root unavailable");
  const created = await fs.createFile(root.id, "photo.png");
  await fs.write(created.id, Uint8Array.from([137, 80, 78, 71]), { truncate: true });
  return { fs, node: await fs.stat(created.id) };
}

async function createSvg() {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("test filesystem root unavailable");
  const content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#7c3aed"/></svg>';
  const created = await fs.createFile(root.id, "vector.svg");
  await fs.write(created.id, new TextEncoder().encode(content), { truncate: true });
  return { fs, node: await fs.stat(created.id), content };
}

function fileNode(name: string, size: number, mime?: string): FsNode {
  return {
    id: `node-${name}`,
    parentId: "root",
    name,
    kind: "file",
    ...(mime ? { mime } : {}),
    size,
    createdAt: 0,
    modifiedAt: 0,
    contentHash: null,
    metadata: {},
  };
}

test("#426 resource thumbnails use canonical image classification without a private suffix table", async () => {
  const { fs, node } = await createImage();

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

test("#509 direct SVG resources preserve vector bytes and MIME in the bounded image loader", async () => {
  const { fs, node, content } = await createSvg();

  expect(node.mime).toBeUndefined();
  expect(imageThumbnailMime(node)).toBe("image/svg+xml");
  expect(canLoadImageThumbnail(node)).toBe(true);

  const blobs: Blob[] = [];
  const revoked: string[] = [];
  const loaded = await loadResourceThumbnail(fs, node, {
    createObjectURL(blob) {
      blobs.push(blob);
      return "blob:svg-thumbnail";
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  });

  expect(loaded?.url).toBe("blob:svg-thumbnail");
  expect(blobs).toHaveLength(1);
  expect(blobs[0]?.type).toBe("image/svg+xml");
  expect(await blobs[0]?.text()).toBe(content);
  loaded?.revoke();
  expect(revoked).toEqual(["blob:svg-thumbnail"]);

  const opaqueRevoked: string[] = [];
  const opaque = await loadImageThumbnail(fs, node, {
    createObjectURL() {
      return "blob:null/svg-thumbnail-509";
    },
    revokeObjectURL(url) {
      opaqueRevoked.push(url);
    },
  });
  expect(opaque?.url).toStartWith("data:image/svg+xml;base64,");
  expect(opaqueRevoked).toEqual(["blob:null/svg-thumbnail-509"]);

  expect(canLoadImageThumbnail(fileNode("empty.svg", 0))).toBe(false);
  expect(canLoadImageThumbnail(fileNode("large.svg", MAX_IMAGE_THUMBNAIL_BYTES + 1))).toBe(false);
});

test("#93 sandbox-null object URLs are revoked and replaced by a loadable data URL", async () => {
  const { fs, node } = await createImage();
  const revoked: string[] = [];
  const loaded = await loadImageThumbnail(fs, node, {
    createObjectURL() {
      return "blob:null/thumbnail-93";
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  });

  expect(loaded?.url).toStartWith("data:image/png;base64,");
  expect(revoked).toEqual(["blob:null/thumbnail-93"]);
  loaded?.revoke();
  expect(revoked).toEqual(["blob:null/thumbnail-93"]);
});

test("#426 direct image thumbnails retain the bounded byte guard", () => {
  const node = fileNode("large.jpg", MAX_IMAGE_THUMBNAIL_BYTES + 1, "image/jpeg");
  expect(canLoadImageThumbnail(node)).toBe(false);
});

test("#94 video thumbnail eligibility is canonical, conservative, and byte bounded", () => {
  const webm = fileNode("clip.webm", 1024);
  const mp4 = fileNode("clip.mp4", 1024, "video/mp4");
  const ogg = fileNode("clip.ogv", 1024, "video/ogg");
  const matroska = fileNode("clip.mkv", 1024, "video/x-matroska");
  const oversize = fileNode("large.webm", MAX_VIDEO_THUMBNAIL_BYTES + 1, "video/webm");
  const empty = fileNode("empty.webm", 0, "video/webm");

  expect(videoThumbnailMime(webm)).toBe("video/webm");
  expect(videoThumbnailMime(mp4)).toBe("video/mp4");
  expect(videoThumbnailMime(ogg)).toBe("video/ogg");
  expect(videoThumbnailMime(matroska)).toBeNull();
  expect(canLoadVideoThumbnail(webm)).toBe(true);
  expect(canLoadVideoThumbnail(oversize)).toBe(false);
  expect(canLoadVideoThumbnail(empty)).toBe(false);
});

test("#94 representative capture geometry and time stay bounded without upscaling", () => {
  expect(videoThumbnailDimensions(1920, 1080)).toEqual({ width: 320, height: 180 });
  expect(videoThumbnailDimensions(160, 90)).toEqual({ width: 160, height: 90 });
  expect(videoThumbnailDimensions(90, 160)).toEqual({ width: 90, height: 160 });
  expect(videoThumbnailDimensions(0, 90)).toBeNull();

  expect(representativeVideoFrameTime(10)).toBe(1);
  expect(representativeVideoFrameTime(0.6)).toBeCloseTo(0.06);
  expect(representativeVideoFrameTime(0)).toBeNull();
  expect(representativeVideoFrameTime(Number.POSITIVE_INFINITY)).toBeNull();
});

test("#94 video thumbnail cleanup runs every registered resource exactly once", () => {
  const events: string[] = [];
  const cleanup = createVideoThumbnailCleanup();
  cleanup.add(() => events.push("source"));
  cleanup.add(() => events.push("timer"));
  cleanup.run();
  cleanup.run();
  cleanup.add(() => events.push("late"));

  expect(events).toEqual(["timer", "source", "late"]);
});
