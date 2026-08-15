import { expect, test } from "bun:test";
import {
  parseCompileMotokoArgs,
  resolveMopsPackages,
  type MopsCommandRunner,
} from "../src/compile_motoko.ts";

test("compile-motoko CLI preserves absolute ICP output paths", () => {
  expect(
    parseCompileMotokoArgs([
      "--source",
      "mo/main.mo",
      "--output",
      "/tmp/icp/dispenser.wasm",
      "--emit-stable-types",
    ]),
  ).toEqual({
    sourcePath: "mo/main.mo",
    outputPath: "/tmp/icp/dispenser.wasm",
    emitStableTypes: true,
  });
});

test("compile-motoko CLI requires explicit source and output", () => {
  expect(() => parseCompileMotokoArgs(["--source", "mo/main.mo"])).toThrow(
    "--output is required",
  );
  expect(() => parseCompileMotokoArgs(["--wat"])).toThrow(
    "Unknown compile-motoko argument",
  );
});

test("Mops packages are integrity-installed before read-only source resolution", async () => {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  const run: MopsCommandRunner = async (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    if (args[0] === "sources") {
      return {
        stdout: "--package core .mops/core@2.6.0/src\n--package sha2 .mops/sha2@0.0.2/src\n",
        stderr: "",
      };
    }
    return { stdout: "", stderr: "" };
  };

  await expect(resolveMopsPackages("/workspace/apps/kernel", run)).resolves.toEqual({
    core: ".mops/core@2.6.0/src",
    sha2: ".mops/sha2@0.0.2/src",
  });
  expect(calls).toEqual([
    {
      command: "mops",
      args: ["install", "--lock", "update"],
      cwd: "/workspace/apps/kernel",
    },
    {
      command: "mops",
      args: ["sources", "--no-install"],
      cwd: "/workspace/apps/kernel",
    },
  ]);
});