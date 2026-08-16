import { expect, test } from "bun:test";
import { resourcePreviewMetadata } from "../fs/resourcePreview.ts";
import { MemoryFsRepository, PersistentFsService } from "../fs/index.ts";
import { loadResourcePreviewThumbnail, type ThumbnailObjectUrlApi } from "./thumbnail.ts";

async function fixture() {
  const fs = new PersistentFsService(new MemoryFsRepository());
  const root = await fs.resolvePath("/");
  if (!root || root.kind !== "directory") throw new Error("test filesystem root unavailable");
  let save = await fs.createFile(root.id, "save.changes", { mime: "application/x-plasmon-jsdos-progress" });
  await fs.write(save.id, Uint8Array.from([1, 2, 3]), { truncate: true });
  const preview = await fs.createFile(root.id, "save.preview.png", { mime: "image/png" });
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await fs.write(preview.id, bytes, { truncate: true });
  save = await fs.setMetadata(save.id, resourcePreviewMetadata({
    nodeId: preview.id,
    mime: "image/png",
    byteSize: bytes.length,
    width: 160,
    height: 100,
  }));
  return { fs, save, preview, bytes };
}

test("#124 FileManager loads a filesystem preview reference through the shared thumbnail path", async () => {
  const { fs, save, bytes } = await fixture();
  const created: Blob[] = [];
  const revoked: string[] = [];
  const urlApi: ThumbnailObjectUrlApi = {
    createObjectURL(blob) {
      created.push(blob);
      return "blob:save-preview";
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };

  const loaded = await loadResourcePreviewThumbnail(fs, save, urlApi);

  expect(loaded?.url).toBe("blob:save-preview");
  expect(created).toHaveLength(1);
  expect(created[0]?.type).toBe("image/png");
  expect(created[0]?.size).toBe(bytes.length);
  loaded?.revoke();
  loaded?.revoke();
  expect(revoked).toEqual(["blob:save-preview"]);
});

test("#124 missing preview resource falls back instead of treating preview as save authority", async () => {
  const { fs, save, preview } = await fixture();
  await fs.remove(preview.id);

  expect(await loadResourcePreviewThumbnail(fs, save, {
    createObjectURL: () => "blob:unexpected",
    revokeObjectURL: () => undefined,
  })).toBeNull();
  expect(Array.from(await fs.read(save.id))).toEqual([1, 2, 3]);
});
