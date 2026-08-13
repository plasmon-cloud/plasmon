// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { AssociationRegistry, FsNode, FsNodeKind, FsService } from "../contracts/index.ts";
import {
  NEUTRON_APP_MIME,
  SYSTEM_APP_MIME,
  neutronAppMetadata,
  shortcutMetadata,
  systemAppMetadata,
} from "../fs/index.ts";
import {
  directFileResourcePresentation,
  fileVisualKind,
  resolveFileResourcePresentation,
  resourceIconPresentationForFile,
} from "./file-icons.ts";

function node(
  name: string,
  kind: FsNodeKind = "file",
  mime?: string,
  metadata: FsNode["metadata"] = {},
): FsNode {
  return {
    id: `node:${name}`,
    parentId: "root",
    name,
    kind,
    ...(mime ? { mime } : {}),
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata,
  };
}

function presentationFs(nodes: readonly FsNode[], apps: readonly FsNode[] = []): FsService {
  const byId = new Map(nodes.map((entry) => [entry.id, entry]));
  const appsDirectory = node("Apps", "directory");
  return {
    stat: async (id) => {
      const found = byId.get(id);
      if (!found) throw new Error(`missing ${id}`);
      return found;
    },
    resolvePath: async (path) => path === "/Apps" ? appsDirectory : null,
    list: async (parentId) => parentId === appsDirectory.id ? [...apps] : [],
  } as unknown as FsService;
}

function associationRegistry(iconByHandler: Readonly<Record<string, string>>): AssociationRegistry {
  return {
    getHandler: (id) => iconByHandler[id]
      ? { id, kind: "native", name: id, icon: iconByHandler[id]!, capabilities: [] }
      : null,
  } as unknown as AssociationRegistry;
}

test("Properties resource presentation maps FileManager semantic kinds to shared artwork", () => {
  expect(resourceIconPresentationForFile(node("Folder", "directory"))).toEqual({ kind: "file-type", icon: "folder" });
  expect(resourceIconPresentationForFile(node("notes.txt", "file", "text/plain"))).toEqual({ kind: "file-type", icon: "text" });
  expect(resourceIconPresentationForFile(node("README.md", "file", "text/markdown"))).toEqual({ kind: "file-type", icon: "markdown" });
  expect(resourceIconPresentationForFile(node("photo.png", "file", "image/png"))).toEqual({ kind: "file-type", icon: "image" });
  expect(resourceIconPresentationForFile(node("movie.webm", "file", "video/webm"))).toEqual({ kind: "file-type", icon: "video" });
  expect(resourceIconPresentationForFile(node("review.atom", "atom"))).toEqual({ kind: "file-type", icon: "atom" });
  expect(resourceIconPresentationForFile(node("opaque.bin"))).toEqual({ kind: "file-type", icon: "file" });
});

test("system and Neutron projections use canonical shared/application artwork", () => {
  const explorer = node(
    "FileManager.sys",
    "file",
    SYSTEM_APP_MIME,
    systemAppMetadata("native:explorer", "native:explorer"),
  );
  expect(directFileResourcePresentation(explorer)).toEqual({ kind: "system", icon: "file-manager" });

  const text = node(
    "TextEditor.sys",
    "file",
    SYSTEM_APP_MIME,
    systemAppMetadata("native:text", "native:text"),
  );
  expect(directFileResourcePresentation(text)).toEqual({ kind: "file-type", icon: "text" });

  const mail = node(
    "Mail.neutron",
    "file",
    NEUTRON_APP_MIME,
    neutronAppMetadata({ elementId: "mail", name: "Mail", icon: "/apps/mail/icon.svg" }),
  );
  expect(directFileResourcePresentation(mail)).toEqual({ kind: "application", src: "/apps/mail/icon.svg" });

  const iconRegistry = associationRegistry({ "native:settings": "data:image/svg+xml,settings" });
  const settings = node(
    "Settings.sys",
    "file",
    SYSTEM_APP_MIME,
    systemAppMetadata("native:settings", "native:settings"),
  );
  expect(directFileResourcePresentation(settings, iconRegistry)).toEqual({
    kind: "application",
    src: "data:image/svg+xml,settings",
  });
});

test("shortcut presentation preserves a filesystem target identity and adds composition state", async () => {
  const target = node(
    "Mail.neutron",
    "file",
    NEUTRON_APP_MIME,
    neutronAppMetadata({ elementId: "mail", icon: "/apps/mail/icon.svg" }),
  );
  const shortcut = node(
    "Mail Shortcut",
    "shortcut",
    undefined,
    shortcutMetadata({ kind: "node", nodeId: target.id }),
  );

  expect(await resolveFileResourcePresentation(presentationFs([target]), shortcut)).toEqual({
    presentation: { kind: "application", src: "/apps/mail/icon.svg" },
    shortcut: true,
  });
});

test("native and Element shortcuts use shared/canonical target artwork without association dispatch", async () => {
  const nativeShortcut = node(
    "Files",
    "shortcut",
    undefined,
    shortcutMetadata({ kind: "native", handlerId: "native:explorer" }),
  );
  expect(await resolveFileResourcePresentation(presentationFs([]), nativeShortcut)).toEqual({
    presentation: { kind: "system", icon: "file-manager" },
    shortcut: true,
  });

  const projection = node(
    "Review.neutron",
    "file",
    NEUTRON_APP_MIME,
    neutronAppMetadata({ elementId: "review", icon: "/apps/review/icon.svg" }),
  );
  const elementShortcut = node(
    "Review",
    "shortcut",
    undefined,
    shortcutMetadata({ kind: "element", elementId: "review" }),
  );
  expect(await resolveFileResourcePresentation(presentationFs([], [projection]), elementShortcut)).toEqual({
    presentation: { kind: "application", src: "/apps/review/icon.svg" },
    shortcut: true,
  });
});

test("missing shortcut targets and missing app icons fail to deterministic shared fallbacks", async () => {
  const missingNode = node(
    "Missing target",
    "shortcut",
    undefined,
    shortcutMetadata({ kind: "node", nodeId: "node:gone" }),
  );
  expect(await resolveFileResourcePresentation(presentationFs([]), missingNode)).toEqual({
    presentation: { kind: "file-type", icon: "file" },
    shortcut: true,
  });

  const missingElement = node(
    "Missing app",
    "shortcut",
    undefined,
    shortcutMetadata({ kind: "element", elementId: "gone" }),
  );
  expect(await resolveFileResourcePresentation(presentationFs([]), missingElement)).toEqual({
    presentation: { kind: "application", src: null },
    shortcut: true,
  });
});

test("shortcut classification remains upstream of shared visual composition", () => {
  const shortcut = node("Docs", "shortcut");
  expect(fileVisualKind(shortcut)).toBe("shortcut");
  expect(resourceIconPresentationForFile(shortcut)).toEqual({ kind: "file-type", icon: "file" });
});
