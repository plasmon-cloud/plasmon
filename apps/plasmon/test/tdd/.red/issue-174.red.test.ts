import { expect, test } from "bun:test";
import type { FsNode, FsService, NativeAppDefinition } from "../../../src/os/contracts/index.ts";
import { SYSTEM_APP_METADATA_KEY, SYSTEM_APP_MIME, classifyResource } from "../../../src/os/fs/resourcePolicy.ts";
import { activateSearchFilesystemResult } from "../../../src/os/shell/activation.ts";
import { categorizeFsNode, searchFilesystem, searchShell } from "../../../src/os/shell/search.ts";

function systemNode(): FsNode {
  return {
    id: "system:browser",
    parentId: "root",
    name: "Browser.sys",
    kind: "file",
    mime: SYSTEM_APP_MIME,
    size: 0,
    createdAt: 1,
    modifiedAt: 1,
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

function staticFs(...children: FsNode[]): FsService {
  const root: FsNode = { id: "root", parentId: null, name: "", kind: "directory", size: 0, createdAt: 0, modifiedAt: 0, metadata: {} };
  return {
    async resolvePath(path) { return path === "/" ? root : null; },
    async list(parentId, options) {
      if (parentId !== "root") return [];
      return children.filter((child) => options?.includeHidden !== false || !child.name.startsWith("."));
    },
  } as FsService;
}

const browserApp: NativeAppDefinition = {
  id: "native:browser",
  handlerId: "native:browser",
  name: "Browser",
  icon: "browser",
  defaultWindow: { width: 800, height: 500 },
  associations: [],
};

test("#174 emits one canonical native-app Search projection instead of a raw .sys document", async () => {
  const batch = await searchShell(staticFs(systemNode()), [browserApp], [], "browser");
  const browserResults = batch.results.filter((result) => result.title.toLocaleLowerCase().includes("browser"));
  expect(browserResults).toHaveLength(1);
  expect(browserResults[0]?.kind).toBe("native-app");
  expect(browserResults[0]?.category).toBe("apps");
  expect(browserResults.some((result) => result.kind === "file")).toBe(false);
  expect(browserResults.some((result) => result.title.endsWith(".sys"))).toBe(false);
});

test("#174 hidden system resources stay hidden and running state does not classify them", async () => {
  const hidden = { ...systemNode(), id: "system:properties", name: ".Properties.sys" };
  const stopped = { ...systemNode(), id: "system:stopped", modifiedAt: 2 };
  const running = { ...systemNode(), id: "system:running", modifiedAt: 3 };
  expect(classifyResource(stopped).kind).toBe("system-app");
  expect(classifyResource(running).kind).toBe("system-app");
  expect(categorizeFsNode(stopped)).toBe("apps");
  expect(categorizeFsNode(running)).toBe("apps");
  const hiddenSearch = await searchFilesystem(staticFs(hidden), "Properties");
  expect(hiddenSearch.results).toHaveLength(0);
});

test("#174 native display presentation does not mutate filesystem identity and activation stays canonical", async () => {
  const original = systemNode();
  const before = structuredClone(original);
  const batch = await searchShell(staticFs(original), [browserApp], [], "browser");
  const app = batch.results.find((result) => result.kind === "native-app");
  expect(app?.title).toBe("Browser");
  expect(original).toEqual(before);
  const raw = (await searchFilesystem(staticFs(original), "Browser")).results.find((result) => result.kind === "file");
  if (!raw || raw.kind !== "file") throw new Error("canonical filesystem result unavailable");
  let opened: string | null = null;
  await activateSearchFilesystemResult({ openNode: async (id) => { opened = id; } }, raw);
  expect(opened).toBe(original.id);
});
