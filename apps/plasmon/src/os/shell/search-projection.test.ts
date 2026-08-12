// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import type { ExternalElement, FsNode, FsService } from "../contracts/index.ts";
import { NEUTRON_APP_MIME, neutronAppMetadata } from "../fs/index.ts";
import { categorizeFsNode, searchShell } from "./search.ts";

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
  input: { elementId: string; name: string; description?: string; icon?: string },
): FsNode {
  return {
    id,
    parentId: "root",
    name: `${input.name}.neutron`,
    kind: "file",
    mime: NEUTRON_APP_MIME,
    size: 0,
    createdAt: 2,
    modifiedAt: 2,
    metadata: neutronAppMetadata(input),
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

test("Search de-duplicates a projection against direct Element discovery while retaining canonical opening identity", async () => {
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
  expect(mail.elementId).toBe(direct.id);
  expect(mail.title).toBe(direct.name);
  expect(mail.subtitle).toBe("Canonical Neutron Mail · Running");
  expect(mail.icon).toBe(direct.icon);

  const calendar = batch.results.find(
    (result) => result.kind === "element" && result.element.id === directOnly.id,
  );
  expect(calendar?.kind).toBe("element");
});

test("Search presents uncertain and metadata-poor Neutron applications without implementation tokens or suffixes", async () => {
  const projection = projectionNode("projection-review", {
    elementId: "review",
    name: "Review",
  });
  const uncertain: ExternalElement = {
    id: "review",
    name: "Review",
    description: "Installed review application",
    tiles: [{ id: "main", title: "Review" }],
    running: "unknown",
  };

  const batch = await searchShell(staticSearchFs([projection]), [], [uncertain], "");
  expect(batch.results).toHaveLength(1);
  const result = batch.results[0];
  expect(result?.kind).toBe("neutron-projection");
  if (!result || result.kind !== "neutron-projection") throw new Error("Review projection result is unavailable");

  expect(result.title).toBe("Review");
  expect(result.title).not.toContain(".neutron");
  expect(result.subtitle).toBe("Installed review application · Availability uncertain");
  expect(result.subtitle).not.toMatch(/\brunning\s+(?:yes|no|unknown)\b/i);
  expect(result.icon).toBeUndefined();
  expect(result.node.name).toBe("Review.neutron");
  expect(result.node.id).toBe("projection-review");

  const metadataPoor = projectionNode("projection-legacy", {
    elementId: "legacy",
    name: "Legacy Tool",
  });
  metadataPoor.name = "Legacy Tool.neutron";
  const fallback = await searchShell(staticSearchFs([{
    ...metadataPoor,
    metadata: neutronAppMetadata({ elementId: "legacy" }),
  }]), [], [], "");
  const legacy = fallback.results[0];
  expect(legacy?.kind).toBe("neutron-projection");
  if (!legacy || legacy.kind !== "neutron-projection") throw new Error("Legacy projection result is unavailable");
  expect(legacy.title).toBe("Legacy Tool");
  expect(legacy.title).not.toContain(".neutron");
  expect(legacy.subtitle).toBe("Neutron application");
});
