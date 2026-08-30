// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { ExternalElement, FsNode, FsService, NativeAppDefinition } from "../contracts/index.ts";
import { NEUTRON_APP_MIME, neutronAppMetadata } from "../fs/index.ts";
import {
  SYSTEM_APP_METADATA_KEY,
  SYSTEM_APP_MIME,
  classifyResource,
} from "../fs/resourcePolicy.ts";
import { activateSearchFilesystemResult } from "./activation.ts";
import {
  categorizeFsNode,
  searchApplicationIcon,
  searchFilesystem,
  searchShell,
} from "./search.ts";

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

function projectionNode(
  id: string,
  input: {
    elementId: string;
    name?: string;
    diskName?: string;
    description?: string;
    icon?: string;
  },
): FsNode {
  return {
    id,
    parentId: "root",
    name: input.diskName ?? `${input.name ?? input.elementId}.neutron`,
    kind: "file",
    mime: NEUTRON_APP_MIME,
    size: 0,
    createdAt: 2,
    modifiedAt: 2,
    metadata: neutronAppMetadata({
      elementId: input.elementId,
      ...(input.name ? { name: input.name } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.icon ? { icon: input.icon } : {}),
    }),
  };
}

function systemNode(
  id = "system:browser",
  name = "Browser.sys",
  modifiedAt = 2,
): FsNode {
  return {
    id,
    parentId: "root",
    name,
    kind: "file",
    mime: SYSTEM_APP_MIME,
    size: 0,
    createdAt: 2,
    modifiedAt,
    metadata: {
      [SYSTEM_APP_METADATA_KEY]: {
        format: "plasmon.system-app",
        version: 1,
        systemId: "browser",
        handlerId: "native:browser",
      },
    },
  };
}

function staticSearchFs(children: readonly FsNode[]): FsService {
  const root = rootNode();
  return {
    async resolvePath(path: string) {
      return path === "/" ? structuredClone(root) : null;
    },
    async list(parentId: string, options?: { includeHidden?: boolean }) {
      if (parentId !== root.id) return [];
      return children
        .filter((node) => options?.includeHidden !== false || !node.name.startsWith("."))
        .map((node) => structuredClone(node));
    },
  } as FsService;
}

function element(
  id: string,
  running: ExternalElement["running"],
  input: { name?: string; description?: string; icon?: string } = {},
): ExternalElement {
  return {
    id,
    name: input.name ?? id,
    description: input.description ?? "",
    ...(input.icon ? { icon: input.icon } : {}),
    tiles: [{ id: "main", title: input.name ?? id }],
    running,
  };
}

const browserApp: NativeAppDefinition = {
  id: "native:browser",
  handlerId: "native:browser",
  name: "Browser",
  icon: "browser",
  defaultWindow: { width: 800, height: 500 },
  associations: [],
};

test("canonical Neutron projection metadata classifies as Apps without trusting the .neutron suffix", () => {
  const projection = projectionNode("projection-mail", {
    elementId: "mail",
    name: "Mail",
    description: "Neutron Mail",
  });
  expect(categorizeFsNode(projection)).toBe("apps");

  const suffixOnly: FsNode = {
    ...projection,
    id: "suffix-only",
    mime: "application/octet-stream",
    metadata: {},
  };
  expect(categorizeFsNode(suffixOnly)).toBe("documents");
});

test("Neutron projection Search presentation uses canonical application metadata without renaming the resource", async () => {
  const projection = projectionNode("projection-review", {
    elementId: "review",
    name: "Review",
    diskName: "Review.neutron",
    description: "Collaborative reviews",
    icon: "review-icon",
  });

  const batch = await searchShell(staticSearchFs([projection]), [], [], "");
  const result = batch.results.find((candidate) => candidate.kind === "neutron-projection");
  expect(result?.kind).toBe("neutron-projection");
  if (!result || result.kind !== "neutron-projection") throw new Error("Review projection result is unavailable");

  expect(result.title).toBe("Review");
  expect(result.title).not.toContain(".neutron");
  expect(result.subtitle).toBe("Collaborative reviews");
  expect(result.node.id).toBe(projection.id);
  expect(result.node.name).toBe("Review.neutron");
  expect(result.icon).toBe("review-icon");
  expect(searchApplicationIcon(result)).toBe("review-icon");
});

test("projection presentation falls back to canonical Element identity instead of the raw filename", async () => {
  const projection = projectionNode("projection-fallback", {
    elementId: "review.fallback",
    diskName: "Internal-Package.neutron",
  });

  const batch = await searchShell(staticSearchFs([projection]), [], [], "");
  const result = batch.results.find((candidate) => candidate.kind === "neutron-projection");
  expect(result?.kind).toBe("neutron-projection");
  if (!result || result.kind !== "neutron-projection") throw new Error("Fallback projection result is unavailable");

  expect(result.title).toBe("review.fallback");
  expect(result.title).not.toBe(projection.name);
  expect(result.subtitle).toBe("Neutron application");
  expect(result.icon).toBeUndefined();
  expect(result.node.name).toBe("Internal-Package.neutron");
});

test("direct Element Search presentation omits runtime state for yes, no, and unknown observations", async () => {
  const running = element("review", "yes", { name: "Review", description: "Collaborative reviews" });
  const stopped = element("mail", "no", { name: "Mail" });
  const unknown = element("calendar", "unknown", { name: "Calendar", description: "Calendar" });

  const batch = await searchShell(staticSearchFs([]), [], [running, stopped, unknown], "");
  const resultFor = (id: string) => batch.results.find(
    (result) => result.kind === "element" && result.element.id === id,
  );

  expect(resultFor("review")?.subtitle).toBe("Collaborative reviews");
  expect(resultFor("mail")?.subtitle).toBe("Neutron application");
  expect(resultFor("calendar")?.subtitle).toBe("Calendar");

  for (const result of batch.results) {
    expect(result.subtitle).not.toMatch(/running|runtime status|stopped/iu);
  }

  const runtimeTokenQuery = await searchShell(staticSearchFs([]), [], [running, stopped, unknown], "unknown");
  expect(runtimeTokenQuery.results).toHaveLength(0);
});

test("Search de-duplicates a projection against direct Element discovery while retaining canonical opening identity and presentation", async () => {
  const projection = projectionNode("projection-mail", {
    elementId: "mail",
    name: "Projected Mail",
    description: "Filesystem projection metadata",
    icon: "projection-icon",
  });
  const direct: ExternalElement = {
    id: "mail",
    name: "Mail",
    description: "Canonical Neutron Mail",
    icon: "canonical-mail-icon",
    version: 7,
    tiles: [{ id: "main", title: "Mail" }],
    running: "yes",
  };
  const directOnly: ExternalElement = {
    id: "calendar",
    name: "Calendar",
    description: "Canonical Neutron Calendar",
    version: 2,
    tiles: [{ id: "main", title: "Calendar" }],
    running: "unknown",
  };

  const batch = await searchShell(staticSearchFs([projection]), [], [direct, directOnly], "");
  const mailResults = batch.results.filter((result) =>
    (result.kind === "element" && result.element.id === direct.id)
      || (result.kind === "neutron-projection" && result.elementId === direct.id),
  );

  expect(mailResults).toHaveLength(1);
  const mail = mailResults[0];
  expect(mail?.kind).toBe("neutron-projection");
  if (!mail || mail.kind !== "neutron-projection") throw new Error("Mail projection result is unavailable");
  expect(mail.category).toBe("apps");
  expect(mail.id).toBe("element:mail");
  expect(mail.node.id).toBe(projection.id);
  expect(mail.node.name).toBe(projection.name);
  expect(mail.elementId).toBe(direct.id);
  expect(mail.title).toBe(direct.name);
  expect(mail.subtitle).toBe("Canonical Neutron Mail");
  expect(mail.icon).toBe(direct.icon);
  expect(searchApplicationIcon(mail)).toBe(direct.icon);

  const directBatch = await searchShell(staticSearchFs([]), [], [direct], "");
  const directResult = directBatch.results.find(
    (result) => result.kind === "element" && result.element.id === direct.id,
  );
  expect(directResult?.title).toBe(mail.title);
  expect(directResult?.subtitle).toBe(mail.subtitle);
  expect(directResult && searchApplicationIcon(directResult)).toBe(mail.icon);

  const calendar = batch.results.find(
    (result) => result.kind === "element" && result.element.id === directOnly.id,
  );
  expect(calendar?.kind).toBe("element");
  expect(calendar?.subtitle).toBe("Canonical Neutron Calendar");
});

test("canonical .sys Search emits one friendly native-app result without a raw duplicate", async () => {
  const node = systemNode();
  const before = structuredClone(node);

  const batch = await searchShell(staticSearchFs([node]), [browserApp], [], "browser");
  const browserResults = batch.results.filter((result) => result.title.toLocaleLowerCase().includes("browser"));

  expect(browserResults).toHaveLength(1);
  expect(browserResults[0]?.kind).toBe("native-app");
  expect(browserResults[0]?.category).toBe("apps");
  expect(browserResults[0]?.title).toBe("Browser");
  expect(browserResults[0]?.subtitle).toBe("Plasmon application");
  expect(browserResults[0]?.subtitle).not.toMatch(/running|stopped|runtime status/iu);
  expect(browserResults.some((result) => result.kind === "file")).toBe(false);
  expect(browserResults.some((result) => result.title.endsWith(".sys"))).toBe(false);
  expect(node).toEqual(before);
});

test("hidden native resources stay hidden and system classification is stable across fixture state", async () => {
  const hidden = systemNode("system:properties", ".Properties.sys");
  const stopped = systemNode("system:stopped", "Browser.sys", 2);
  const running = systemNode("system:running", "Browser.sys", 3);

  for (const node of [stopped, running]) {
    expect(classifyResource(node).kind).toBe("system-app");
    expect(categorizeFsNode(node)).toBe("apps");
  }

  const hiddenSearch = await searchFilesystem(staticSearchFs([hidden]), "Properties");
  expect(hiddenSearch.results).toHaveLength(0);
});

test("native Search presentation preserves NodeId and filesystem activation opens the canonical node", async () => {
  const node = systemNode();
  const before = structuredClone(node);

  const batch = await searchShell(staticSearchFs([node]), [browserApp], [], "browser");
  const app = batch.results.find((result) => result.kind === "native-app");
  expect(app?.title).toBe("Browser");
  expect(node).toEqual(before);

  const raw = (await searchFilesystem(staticSearchFs([node]), "Browser")).results.find(
    (result) => result.kind === "file",
  );
  if (!raw || raw.kind !== "file") throw new Error("canonical filesystem result unavailable");
  expect(raw.node.id).toBe(node.id);
  expect(raw.node.name).toBe("Browser.sys");

  let opened: string | null = null;
  await activateSearchFilesystemResult({
    openNode: async (id) => {
      opened = id;
    },
  }, raw);
  expect(opened).toBe(node.id);
  expect(node).toEqual(before);
});
