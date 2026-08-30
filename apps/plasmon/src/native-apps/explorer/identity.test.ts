import { expect, test } from "bun:test";
import { explorerAppDefinition } from "./index.ts";
import {
  FILE_MANAGER_NAME,
  fileManagerLocationLabel,
  fileManagerWindowTitle,
} from "./identity.ts";

test("File Explorer keeps its internal native identity while presenting one product name", () => {
  expect(explorerAppDefinition.id).toBe("native:explorer");
  expect(explorerAppDefinition.handlerId).toBe("native:explorer");
  expect(explorerAppDefinition.name).toBe(FILE_MANAGER_NAME);
  expect(FILE_MANAGER_NAME).toBe("File Explorer");
});

test("File Explorer window titles retain the current location and canonical app name", () => {
  expect(fileManagerLocationLabel("/")).toBe("This Plasmon");
  expect(fileManagerWindowTitle("/")).toBe("This Plasmon — File Explorer");
  expect(fileManagerWindowTitle("/Documents")).toBe("Documents — File Explorer");
  expect(fileManagerWindowTitle("/System/Program Files")).toBe("Program Files — File Explorer");
});
