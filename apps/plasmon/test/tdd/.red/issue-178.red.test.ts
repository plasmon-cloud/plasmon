import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { editorLanguageForName } from "../../../src/native-apps/text/editorModel.ts";
import { inferImageMime } from "../../../src/native-apps/photos/media.ts";
import { categorizeFsNode } from "../../../src/os/shell/search.ts";
import type { FsNode } from "../../../src/os/contracts/index.ts";

const node = (name: string, mime?: string): FsNode => ({
  id: `node:${name}`,
  parentId: "root",
  name,
  kind: "file",
  ...(mime ? { mime } : {}),
  size: 1,
  createdAt: 0,
  modifiedAt: 0,
  metadata: {},
});

test("#178 explicit MIME remains authoritative for image/media classification", () => {
  // A PNG name carrying an explicit text MIME is not an image resource. The
  // current Photos helper only accepts image MIME values and falls through to
  // the filename guess, demonstrating the cross-consumer precedence defect.
  expect(inferImageMime("note.png", "text/plain")).toBe("text/plain");
});

test("#178 explicit MIME remains authoritative for Monaco language", () => {
  // Text currently derives Monaco language from the name alone. A pinned
  // text/plain resource must not become Markdown merely because it was renamed
  // or carries a misleading suffix.
  const languageForResource = editorLanguageForName as unknown as (name: string, mime?: string) => string;
  expect(languageForResource("note.md", "text/plain")).toBe("plaintext");
});

test("#178 derived type stays coherent with Search and stable NodeId after rename", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await environment.node("/Documents");
    if (!documents) throw new Error("Documents bootstrap missing");
    const created = await environment.services.fs.createFile(documents.id, "sample.json", { mime: "application/json" });
    expect(categorizeFsNode(created)).toBe("documents");
    const renamed = await environment.services.fs.rename(created.id, "sample.ts");
    expect(renamed.id).toBe(created.id);
    expect(categorizeFsNode(renamed)).toBe("documents");
    expect(renamed.mime).toBe("application/json");
  } finally {
    environment.dispose();
  }
});
