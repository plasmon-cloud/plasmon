import { expect, test } from "bun:test";
import type { ExternalElement, FsNode } from "../src/os/contracts/index.ts";
import { associationTypeKey } from "../src/os/associations/index.ts";
import { activateFileManagerNode } from "../src/os/file-manager/index.ts";
import { createShortcut } from "../src/os/fs/index.ts";
import {
  activateSearchFilesystemResult,
  activateStartFilesystemNode,
  searchFilesystem,
  type FilesystemSearchResult,
} from "../src/os/shell/index.ts";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
} from "./headlessEnvironment.ts";

const DEMO_ELEMENT: ExternalElement = {
  id: "cross-surface-open",
  name: "Cross Surface Open",
  description: "Headless cross-surface opening fixture.",
  version: 1,
  tiles: [{ id: "main", title: "Cross Surface Open" }],
  running: "no",
};

const SURFACES = ["file-manager", "start", "search"] as const;
type Surface = (typeof SURFACES)[number];

type SurfaceNodes = Readonly<Record<Surface, FsNode>>;

function requireDirectory(node: FsNode | null, path: string): FsNode {
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

async function searchResultFor(
  environment: HeadlessPlasmonEnvironment,
  node: FsNode,
): Promise<FilesystemSearchResult> {
  const batch = await searchFilesystem(environment.services.fs, node.name);
  const result = batch.results.find(
    (candidate) => "node" in candidate && candidate.node.id === node.id,
  );
  if (!result || !("node" in result)) {
    throw new Error(`Search did not expose filesystem node ${node.name}`);
  }
  return result;
}

async function activate(
  environment: HeadlessPlasmonEnvironment,
  surface: Surface,
  node: FsNode,
): Promise<void> {
  switch (surface) {
    case "file-manager":
      await activateFileManagerNode(environment.services.filesystem.open, node);
      return;
    case "start":
      await activateStartFilesystemNode(environment.services.filesystem.open, node);
      return;
    case "search":
      await activateSearchFilesystemResult(
        environment.services.filesystem.open,
        await searchResultFor(environment, node),
      );
      return;
  }
}

async function processOutcome(
  environment: HeadlessPlasmonEnvironment,
  surface: Surface,
  node: FsNode,
): Promise<{ handlerId: string; nodeId: string | null }> {
  expect(environment.processes()).toHaveLength(0);
  await activate(environment, surface, node);
  const processes = environment.processes();
  expect(processes).toHaveLength(1);
  const process = processes[0];
  if (!process) throw new Error(`${surface} did not open a native process`);
  const outcome = {
    handlerId: process.handlerId,
    nodeId: process.target.nodeId ?? null,
  };
  environment.services.process.close(process.id);
  expect(environment.processes()).toHaveLength(0);
  return outcome;
}

async function neutronOutcome(
  environment: HeadlessPlasmonEnvironment,
  surface: Surface,
  node: FsNode,
): Promise<readonly string[]> {
  expect(environment.processes()).toHaveLength(0);
  const before = environment.neutronMessages.length;
  await activate(environment, surface, node);
  expect(environment.processes()).toHaveLength(0);
  return environment.neutronMessages.slice(before);
}

test("FileManager, Start, and Search share canonical filesystem-open outcomes", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [DEMO_ELEMENT] });

  try {
    await environment.ready;
    const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
    const startMenu = requireDirectory(
      await environment.node("/System/Start Menu"),
      "/System/Start Menu",
    );

    // Use a non-built-in preference order so the ordinary-file case proves the
    // production AssociationRegistry/default + OpenService path is being consumed.
    const note = await environment.services.fs.createFile(
      documents.id,
      "Cross Surface Association.md",
      { mime: "text/markdown" },
    );
    await environment.services.fs.write(
      note.id,
      new TextEncoder().encode("shared canonical association path"),
      { truncate: true },
    );
    await environment.services.associations.setUserDefault(
      associationTypeKey.extension(".md"),
      "native:text",
    );
    expect((await environment.services.associations.resolve(note))[0]?.id).toBe("native:text");

    const noteShortcut = await createShortcut(
      environment.services.fs,
      startMenu.id,
      { kind: "node", nodeId: note.id },
      { name: "Cross Surface Note" },
    );

    const photos = await environment.node("/System/Photos.sys");
    if (!photos) throw new Error("Photos.sys is unavailable");
    const photosShortcut = await createShortcut(
      environment.services.fs,
      startMenu.id,
      { kind: "node", nodeId: photos.id },
      { name: "Cross Surface Photos" },
    );

    const neutronProjection = await environment.node("/Apps/Cross Surface Open.neutron");
    if (!neutronProjection) throw new Error("Cross Surface Open.neutron projection is unavailable");
    const neutronShortcut = await createShortcut(
      environment.services.fs,
      startMenu.id,
      { kind: "node", nodeId: neutronProjection.id },
      { name: "Cross Surface Neutron" },
    );

    const processCases: readonly {
      nodes: SurfaceNodes;
      expected: { handlerId: string; nodeId: string | null };
    }[] = [
      {
        nodes: {
          "file-manager": note,
          start: noteShortcut,
          search: note,
        },
        expected: { handlerId: "native:text", nodeId: note.id },
      },
      {
        nodes: {
          "file-manager": noteShortcut,
          start: noteShortcut,
          search: noteShortcut,
        },
        expected: { handlerId: "native:text", nodeId: note.id },
      },
      {
        nodes: {
          "file-manager": photos,
          start: photosShortcut,
          search: photos,
        },
        expected: { handlerId: "native:photos", nodeId: photos.id },
      },
    ];

    for (const resource of processCases) {
      const outcomes = [];
      for (const surface of SURFACES) {
        outcomes.push(await processOutcome(environment, surface, resource.nodes[surface]));
      }
      expect(outcomes).toEqual([
        resource.expected,
        resource.expected,
        resource.expected,
      ]);
    }

    const neutronNodes: SurfaceNodes = {
      "file-manager": neutronProjection,
      start: neutronShortcut,
      search: neutronProjection,
    };
    for (const surface of SURFACES) {
      expect(await neutronOutcome(environment, surface, neutronNodes[surface])).toEqual([
        "[Plasmon preview] Open Cross Surface Open/main",
      ]);
    }
  } finally {
    environment.dispose();
  }
});
