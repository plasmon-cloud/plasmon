// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { ExternalElement, FsNode, FsService, NativeAppDefinition } from "../contracts/index.ts";
import { NEUTRON_APP_MIME, SYSTEM_APP_MIME, neutronAppMetadata } from "../fs/index.ts";
import { searchApplicationIcon, searchShell } from "./search.ts";

function rootNode(): FsNode {
  return {
    id: "root",
    parentId: null,
    name: "",
    kind: "directory",
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

function staticSearchFs(children: readonly FsNode[]): FsService {
  const root = rootNode();
  return {
    async resolvePath(path: string) {
      return path === "/" ? structuredClone(root) : null;
    },
    async list(parentId: string) {
      return parentId === root.id ? children.map((node) => structuredClone(node)) : [];
    },
  } as FsService;
}

function systemProjection(): FsNode {
  return {
    id: "system-settings",
    parentId: "root",
    name: "Settings.sys",
    kind: "file",
    mime: SYSTEM_APP_MIME,
    size: 0,
    createdAt: 2,
    modifiedAt: 2,
    metadata: {
      "plasmon.systemApp": {
        format: "plasmon.system-app",
        version: 1,
        systemId: "settings",
        handlerId: "native:settings",
      },
    },
  };
}

function nativeSettings(): NativeAppDefinition {
  return {
    id: "settings",
    handlerId: "native:settings",
    name: "Settings",
    icon: "settings-icon",
    singleton: true,
    defaultWindow: { width: 640, height: 480 },
    associations: [],
  };
}

function neutronProjection(): FsNode {
  return {
    id: "projection-mail",
    parentId: "root",
    name: "Mail.neutron",
    kind: "file",
    mime: NEUTRON_APP_MIME,
    size: 0,
    createdAt: 2,
    modifiedAt: 2,
    metadata: neutronAppMetadata({
      elementId: "mail",
      name: "Projected Mail",
      description: "Filesystem projection metadata",
      icon: "projection-icon",
    }),
  };
}

function mailElement(): ExternalElement {
  return {
    id: "mail",
    name: "Mail",
    description: "Canonical Neutron Mail",
    icon: "canonical-mail-icon",
    version: 7,
    tiles: [{ id: "main", title: "Mail" }],
    running: "yes",
  };
}

test("#174 RED — canonical .sys NodeId is the only visible native application Search identity", async () => {
  const projection = systemProjection();
  const settings = nativeSettings();

  const batch = await searchShell(staticSearchFs([projection]), [settings], [], "");
  const settingsResults = batch.results.filter((result) => result.category === "apps" && result.title === "Settings");
  expect(settingsResults).toHaveLength(1);
  const result = settingsResults[0];
  expect(result?.kind).not.toBe("native-app");
  if (!result || !("node" in result)) throw new Error("Settings canonical filesystem result is unavailable");
  expect(result.node.id).toBe(projection.id);
  expect(result.node.name).toBe("Settings.sys");
  expect(result.subtitle).toBe("Plasmon application");
  expect(searchApplicationIcon(result)).toBe(settings.icon);

  const registryOnly = await searchShell(staticSearchFs([]), [settings], [], "");
  expect(registryOnly.results.filter((candidate) => candidate.category === "apps")).toHaveLength(0);
});

test("#174 RED — canonical .neutron NodeId is the only visible Element identity and runtime state is not Search presentation", async () => {
  const projection = neutronProjection();
  const direct = mailElement();

  const batch = await searchShell(staticSearchFs([projection]), [], [direct], "");
  const mailResults = batch.results.filter((result) =>
    (result.kind === "element" && result.element.id === direct.id)
      || (result.kind === "neutron-projection" && result.elementId === direct.id),
  );
  expect(mailResults).toHaveLength(1);
  const mail = mailResults[0];
  expect(mail?.kind).toBe("neutron-projection");
  if (!mail || mail.kind !== "neutron-projection") throw new Error("Mail projection result is unavailable");
  expect(mail.node.id).toBe(projection.id);
  expect(mail.node.name).toBe(projection.name);
  expect(mail.title).toBe(direct.name);
  expect(mail.subtitle).toBe("Canonical Neutron Mail");
  expect(mail.subtitle).not.toMatch(/running|stopped|runtime status/iu);
  expect(searchApplicationIcon(mail)).toBe(direct.icon);

  const registryOnly = await searchShell(staticSearchFs([]), [], [direct], "");
  expect(registryOnly.results.filter((candidate) => candidate.category === "apps")).toHaveLength(0);
});
