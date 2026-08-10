import type { FsNode, FsService, NodeId } from "../contracts/index.ts";

export type NewDocumentKind = "text" | "markdown";

const DOCUMENT_SPECS: Record<NewDocumentKind, { name: string; mime: string }> = {
  text: { name: "New Text Document.txt", mime: "text/plain" },
  markdown: { name: "New Markdown Document.md", mime: "text/markdown" },
};

/** Creates a normal filesystem document; collision behavior remains FsService-owned. */
export function createDocument(
  fs: FsService,
  directoryId: NodeId,
  kind: NewDocumentKind,
): Promise<FsNode> {
  const spec = DOCUMENT_SPECS[kind];
  return fs.createFile(directoryId, spec.name, { mime: spec.mime });
}

export const IMPORT_CHUNK_BYTES = 256 * 1024;

export interface ImportBlobSlice {
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Browser File satisfies this interface directly, while tests need no DOM File implementation. */
export interface ImportFileSource {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  slice(start?: number, end?: number): ImportBlobSlice;
}

export async function importFileIntoFs(
  fs: FsService,
  directoryId: NodeId,
  source: ImportFileSource,
  chunkBytes = IMPORT_CHUNK_BYTES,
): Promise<FsNode> {
  if (!Number.isSafeInteger(source.size) || source.size < 0) {
    throw new Error(`Invalid file size for ${source.name}`);
  }
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) {
    throw new Error("Import chunk size must be a positive safe integer");
  }

  const created = await fs.createFile(
    directoryId,
    source.name,
    source.type ? { mime: source.type } : undefined,
  );
  let current = created;

  try {
    for (let offset = 0; offset < source.size; offset += chunkBytes) {
      const end = Math.min(source.size, offset + chunkBytes);
      const expectedLength = end - offset;
      const bytes = new Uint8Array(await source.slice(offset, end).arrayBuffer());
      if (bytes.byteLength !== expectedLength) {
        throw new Error(`Short read while importing ${source.name}`);
      }
      current = await fs.write(
        created.id,
        bytes,
        offset === 0 ? { offset: 0, truncate: true } : { offset },
      );
    }
    return current;
  } catch (cause: unknown) {
    try {
      await fs.remove(created.id);
    } catch {
      // Best-effort cleanup must not replace the original import error.
    }
    throw cause;
  }
}
