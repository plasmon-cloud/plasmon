import { expect, test } from "bun:test";
import type { JsonValue } from "../contracts/index.ts";
import {
  readResourceArtworkMetadata,
  resourceArtworkMetadata,
} from "../fs/resourceArtwork.ts";
import { classifyResource } from "../fs/resourcePolicy.ts";
import { resourcePresentationForClassification } from "./resource-presentation.ts";

function gameNode(metadata: Record<string, JsonValue> = {}) {
  return {
    name: "PlasmonDemo.jsdos",
    kind: "file" as const,
    mime: "application/x-jsdos",
    metadata,
  };
}

test("#123 characterization: game resources without artwork use the canonical shared fallback", () => {
  const classification = classifyResource(gameNode());

  expect(classification.kind).toBe("ordinary-file");
  expect(resourcePresentationForClassification(classification)).toEqual({
    kind: "file-type",
    icon: "file",
  });
});

test("#123 validated package-local artwork maps through the shared thumbnail vocabulary", () => {
  const node = gameNode(resourceArtworkMetadata({
    src: "static/plasmon/artwork/plasmon-demo.svg",
    mime: "image/svg+xml",
    byteSize: 1193,
  }));
  const artwork = readResourceArtworkMetadata(node);

  expect(artwork).toEqual({
    format: "plasmon.resource-artwork",
    version: 1,
    source: "package-local",
    src: "static/plasmon/artwork/plasmon-demo.svg",
    mime: "image/svg+xml",
    byteSize: 1193,
  });
  expect(resourcePresentationForClassification(classifyResource(node), { artwork })).toEqual({
    kind: "thumbnail",
    src: "static/plasmon/artwork/plasmon-demo.svg",
    mediaKind: "image",
  });
});

test("#123 invalid artwork metadata is ignored and preserves the canonical fallback", () => {
  const node = gameNode({
    "plasmon.resourceArtwork": {
      format: "plasmon.resource-artwork",
      version: 1,
      source: "package-local",
      src: "https://covers.invalid/game.svg",
      mime: "image/svg+xml",
      byteSize: 1193,
    },
  });

  expect(readResourceArtworkMetadata(node)).toBeNull();
  expect(resourcePresentationForClassification(classifyResource(node), {
    artwork: readResourceArtworkMetadata(node),
  })).toEqual({ kind: "file-type", icon: "file" });
});
