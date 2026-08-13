import { expect, test } from "bun:test";
import type { FsNode, FsService, NativeAppDefinition } from "../../../src/os/contracts/index.ts";
import { SYSTEM_APP_METADATA_KEY, SYSTEM_APP_MIME } from "../../../src/os/fs/resourcePolicy.ts";
import { searchShell } from "../../../src/os/shell/search.ts";

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

function staticFs(child: FsNode): FsService {
  const root: FsNode = { id: "root", parentId: null, name: "", kind: "directory", size: 0, createdAt: 0, modifiedAt: 0, metadata: {} };
  return { async resolvePath(path) { return path === "/" ? root : null; }, async list(parentId) { return parentId === "root" ? [child] : []; } } as FsService;
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
