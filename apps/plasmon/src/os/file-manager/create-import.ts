import type { FsNode, FsService, NodeId } from "../contracts/index.ts";
import { collisionFreeName, normalizedSiblingName } from "./naming.ts";

export type NewDocumentKind = "text" | "markdown" | "cmd" | "run";

const DOCUMENT_NAMES: Record<NewDocumentKind, string> = {
  text: "New Text Document.txt",
  markdown: "New Markdown Document.md",
  cmd: "New Command Script.cmd",
  run: "New Run Script.run",
};

const DOCUMENT_TEMPLATES: Partial<Record<NewDocumentKind, string>> = {
  cmd: "# Plasmon command script\n# Try: help\necho \"Hello from Plasmon\"\n",
  run: "// Plasmon executable TypeScript (.run)\nprint(\"Hello from Plasmon\");\n",
};

const textEncoder = new TextEncoder();

async function siblingNames(fs: FsService, directoryId: NodeId): Promise<Set<string>> {
  return new Set((await fs.list(directoryId)).map((node) => normalizedSiblingName(node.name)));
}

export async function createGeneratedFolder(
  fs: FsService,
  directoryId: NodeId,
  requestedName = "New Folder",
): Promise<FsNode> {
  const name = collisionFreeName(requestedName, true, await siblingNames(fs, directoryId));
  return fs.mkdir(directoryId, name);
}

/**
 * Creates a normal filesystem document with a collision-free generated name.
 *
 * The generated filename is the type authority for these blank documents. Do
 * not persist the filename-derived MIME as explicit metadata: FileManager
 * immediately offers inline rename, and a later `.txt -> .js` / `.md -> .js`
 * rename must remain eligible for canonical filename-derived classification.
 */
export async function createDocument(
  fs: FsService,
  directoryId: NodeId,
  kind: NewDocumentKind,
): Promise<FsNode> {
  const name = collisionFreeName(DOCUMENT_NAMES[kind], false, await siblingNames(fs, directoryId));
  let created = await fs.createFile(directoryId, name);
  const template = DOCUMENT_TEMPLATES[kind];
  if (template) created = await fs.write(created.id, textEncoder.encode(template), { offset: 0, truncate: true });
  return created;
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
