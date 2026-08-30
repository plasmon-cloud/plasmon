// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import type { ExternalElement, FsNode } from "../contracts/index.ts";
import {
  NEUTRON_APP_METADATA_KEY,
  NEUTRON_APP_MIME,
  SYSTEM_APP_METADATA_KEY,
  SYSTEM_APP_MIME,
} from "../fs/resourcePolicy.ts";
import { shortcutMetadata } from "../fs/shortcut.ts";
import {
  activateSearchFilesystemResult,
  activateStartFilesystemNode,
  type FilesystemSearchResult,
} from "./activation.ts";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";

const mailElement: ExternalElement = {
  id: "mail",
  name: "Mail",
  description: "Mail Element",
  version: 1,
  tiles: [{ id: "main", title: "Main" }],
  running: "no",
};

function searchResult(node: FsNode): FilesystemSearchResult {
  if (node.kind === "directory") {
    return {
      kind: "directory",
      id: `directory:${node.id}`,
      category: "documents",
      title: node.name,
      subtitle: "Folder",
      node,
    };
  }
  return {
    kind: "file",
    id: `node:${node.id}`,
    category: "documents",
    title: node.name,
    subtitle: node.mime ?? "Document",
    node,
  };
}

function closeProcesses(environment: ReturnType<typeof createHeadlessPlasmonEnvironment>): void {
  for (const process of environment.services.process.list()) environment.services.process.close(process.id);
}

test("Start filesystem activation delegates shortcut semantics to the canonical dispatcher", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const documents = await environment.node("/Documents");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

    const note = await environment.services.fs.createFile(documents.id, "start-target.txt", { mime: "text/plain" });
    const shortcut = await environment.services.fs.createFile(documents.id, "Start Target", {
      kind: "shortcut",
      metadata: shortcutMetadata({ kind: "node", nodeId: note.id }),
    });

    await activateStartFilesystemNode(environment.services.filesystem.open, shortcut);

    const processes = environment.processes();
    expect(processes).toHaveLength(1);
    expect(processes[0]?.handlerId).toBe("native:text");
    expect(processes[0]?.target.nodeId).toBe(note.id);
  } finally {
    environment.dispose();
  }
});

test("Search filesystem activation preserves canonical directory, system-app, Neutron-app, and association semantics", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [mailElement] });
  try {
    await environment.ready;
    const documents = await environment.node("/Documents");
    if (!documents || documents.kind !== "directory") throw new Error("Documents directory is unavailable");

    const folder = await environment.services.fs.mkdir(documents.id, "Search Folder");
    await activateSearchFilesystemResult(environment.services.filesystem.open, searchResult(folder));
    expect(environment.processes()[0]?.handlerId).toBe("native:explorer");
    expect(environment.processes()[0]?.target.nodeId).toBe(folder.id);
    closeProcesses(environment);

    const associated = await environment.services.fs.createFile(documents.id, "search-note.txt", { mime: "text/plain" });
    await activateSearchFilesystemResult(environment.services.filesystem.open, searchResult(associated));
    expect(environment.processes()[0]?.handlerId).toBe("native:text");
    expect(environment.processes()[0]?.target.nodeId).toBe(associated.id);
    closeProcesses(environment);

    const systemApp = await environment.services.fs.createFile(documents.id, "Text.sys", {
      mime: SYSTEM_APP_MIME,
      metadata: {
        [SYSTEM_APP_METADATA_KEY]: {
          format: "plasmon.system-app",
          version: 1,
          systemId: "text-test",
          handlerId: "native:text",
        },
      },
    });
    await activateSearchFilesystemResult(environment.services.filesystem.open, searchResult(systemApp));
    expect(environment.processes()[0]?.handlerId).toBe("native:text");
    expect(environment.processes()[0]?.target.nodeId).toBe(systemApp.id);
    closeProcesses(environment);

    const neutronApp = await environment.services.fs.createFile(documents.id, "Mail.neutron", {
      mime: NEUTRON_APP_MIME,
      metadata: {
        [NEUTRON_APP_METADATA_KEY]: {
          format: "plasmon-neutron-app",
          version: 1,
          elementId: "mail",
          name: "Mail",
        },
      },
    });
    await activateSearchFilesystemResult(environment.services.filesystem.open, searchResult(neutronApp));
    expect(environment.neutronMessages).toContain("[Plasmon preview] Open Mail/main");
  } finally {
    environment.dispose();
  }
});
