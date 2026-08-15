import { expect, test } from "bun:test";
import { classifyResource } from "../fs/resourcePolicy.ts";
import { resourcePresentationForClassification } from "./resource-presentation.ts";

test("#123 characterization: game resources without artwork use the canonical shared fallback", () => {
  const classification = classifyResource({
    name: "PlasmonDemo.jsdos",
    kind: "file",
    mime: "application/x-jsdos",
    metadata: {},
  });

  expect(classification.kind).toBe("ordinary-file");
  expect(resourcePresentationForClassification(classification)).toEqual({
    kind: "file-type",
    icon: "file",
  });
});
