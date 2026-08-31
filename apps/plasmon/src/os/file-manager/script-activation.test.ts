import { describe, expect, test } from "bun:test";
import type { OpenService, OpenTarget } from "../contracts/index.ts";
import { activateExecutableScript, isExecutableScriptNode } from "./script-activation.ts";

class RecordingOpenService implements OpenService {
  readonly calls: Array<{ handlerId: string; target: OpenTarget }> = [];

  async open(handlerId: string, target: OpenTarget): Promise<void> {
    this.calls.push({ handlerId, target });
  }
}

describe("File Manager script activation", () => {
  test("recognizes .cmd/.run case-insensitively and excludes ordinary files", () => {
    expect(isExecutableScriptNode({ kind: "file", name: "setup.cmd" })).toBe(true);
    expect(isExecutableScriptNode({ kind: "file", name: "SETUP.RUN" })).toBe(true);
    expect(isExecutableScriptNode({ kind: "file", name: "setup.ts" })).toBe(false);
    expect(isExecutableScriptNode({ kind: "directory", name: "setup.cmd" })).toBe(false);
  });

  test("launches executable scripts through Terminal with the exact stable node id", async () => {
    const openService = new RecordingOpenService();
    const opened = await activateExecutableScript(openService, {
      id: "node-script-42",
      kind: "file",
      name: "Scripting Smoke.run",
    });

    expect(opened).toBe(true);
    expect(openService.calls).toEqual([
      { handlerId: "native:terminal", target: { nodeId: "node-script-42" } },
    ]);
  });

  test("does not claim ordinary document activation", async () => {
    const openService = new RecordingOpenService();
    const opened = await activateExecutableScript(openService, {
      id: "node-text-1",
      kind: "file",
      name: "notes.txt",
    });

    expect(opened).toBe(false);
    expect(openService.calls).toEqual([]);
  });
});
