import { expect, test } from "bun:test";
import type { ExternalElement, FsNode } from "../src/os/contracts/index.ts";
import { activateFileManagerNode } from "../src/os/file-manager/index.ts";
import { createShortcut, NEUTRON_APP_MIME } from "../src/os/fs/index.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

const DEMO_ELEMENT: ExternalElement = {
  id: "activation-demo",
  name: "Activation Demo",
  description: "Headless FileManager activation fixture.",
  version: 1,
  tiles: [{ id: "main", title: "Activation Demo" }],
  running: "no",
};

function requireDirectory(node: FsNode | null, path: string): FsNode {
  if (!node || node.kind !== "directory") throw new Error(`${path} directory is unavailable`);
  return node;
}

test("FileManager activation keeps directory navigation presentation-owned while dispatcher resolves shortcuts", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [DEMO_ELEMENT] });

  try {
    await environment.ready;
    const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
    const desktop = requireDirectory(await environment.node("/Desktop"), "/Desktop");
    const navigated: FsNode[] = [];
    const navigate = (node: FsNode) => { navigated.push(node); };

    await activateFileManagerNode(environment.services.filesystem.open, documents, {
      onOpenDirectory: navigate,
    });
    expect(navigated.map((node) => node.id)).toEqual([documents.id]);
    expect(environment.processes()).toHaveLength(0);

    const directoryShortcut = await createShortcut(
      environment.services.fs,
      desktop.id,
      { kind: "node", nodeId: documents.id },
      { name: "Documents shortcut" },
    );
    await activateFileManagerNode(environment.services.filesystem.open, directoryShortcut, {
      onOpenDirectory: navigate,
    });
    expect(navigated.map((node) => node.id)).toEqual([documents.id, documents.id]);
    expect(environment.processes()).toHaveLength(0);

    await activateFileManagerNode(environment.services.filesystem.open, documents);
    const explorer = environment.processes().at(-1);
    expect(explorer?.handlerId).toBe("native:explorer");
    expect(explorer?.target.nodeId).toBe(documents.id);
    if (explorer) environment.services.process.close(explorer.id);
  } finally {
    environment.dispose();
  }
});

test("FileManager activation uses canonical policy for associated files, shortcuts, system apps, and Neutron apps", async () => {
  const environment = createHeadlessPlasmonEnvironment({ elements: [DEMO_ELEMENT] });

  try {
    await environment.ready;
    const documents = requireDirectory(await environment.node("/Documents"), "/Documents");
    const desktop = requireDirectory(await environment.node("/Desktop"), "/Desktop");

    const note = await environment.services.fs.createFile(documents.id, "activation.txt", {
      mime: "text/plain",
    });
    await environment.services.fs.write(
      note.id,
      new TextEncoder().encode("canonical FileManager open path"),
      { truncate: true },
    );

    await activateFileManagerNode(environment.services.filesystem.open, note);
    let opened = environment.processes().at(-1);
    expect(opened?.handlerId).toBe("native:text");
    expect(opened?.target.nodeId).toBe(note.id);
    if (opened) environment.services.process.close(opened.id);

    const fileShortcut = await createShortcut(
      environment.services.fs,
      desktop.id,
      { kind: "node", nodeId: note.id },
      { name: "Activation note shortcut" },
    );
    await activateFileManagerNode(environment.services.filesystem.open, fileShortcut);
    opened = environment.processes().at(-1);
    expect(opened?.handlerId).toBe("native:text");
    expect(opened?.target.nodeId).toBe(note.id);
    expect(opened?.target.nodeId).not.toBe(fileShortcut.id);
    if (opened) environment.services.process.close(opened.id);

    const photos = await environment.node("/System/Photos.sys");
    expect(photos).not.toBeNull();
    if (!photos) throw new Error("Photos.sys is unavailable");
    await activateFileManagerNode(environment.services.filesystem.open, photos);
    opened = environment.processes().at(-1);
    expect(opened?.handlerId).toBe("native:photos");
    expect(opened?.target.nodeId).toBe(photos.id);
    if (opened) environment.services.process.close(opened.id);

    const neutronApp = await environment.node("/Apps/Activation Demo.neutron");
    expect(neutronApp).not.toBeNull();
    if (!neutronApp) throw new Error("Activation Demo.neutron projection is unavailable");

    environment.services.associations.registerRule({
      id: "test:neutron-projection-text-fallback",
      handlerId: "native:text",
      mimeTypes: [NEUTRON_APP_MIME],
      priority: 1_000_000,
    });
    expect((await environment.services.associations.resolve(neutronApp))[0]?.id).toBe("native:text");

    await activateFileManagerNode(environment.services.filesystem.open, neutronApp);
    expect(environment.neutronMessages).toContain("[Plasmon preview] Open Activation Demo/main");
    expect(environment.processes()).toHaveLength(0);
    expect(environment.windows()).toHaveLength(0);
  } finally {
    environment.dispose();
  }
});
