import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../test/headlessEnvironment.ts";
import { classifyResource } from "../os/fs/index.ts";
import { DEFAULT_SHELL_PREFERENCES } from "../os/shell/preferences.ts";
import { SimpleCmdParser } from "./cmd/simple.ts";
import { transpileCmdToRun } from "./cmd/transpile.ts";
import { renderShellHelp, shellCommandHelp, SHELL_COMMAND_NAMES } from "./command/catalog.ts";
import { CommandSession } from "./command/runtime.ts";
import { RUN_CONTEXT_DECLARATIONS } from "./os-api/declarations.ts";
import { ScriptingService } from "./service.ts";

test(".cmd parser lowers quotes, pipelines, and redirection to readable .run TypeScript", async () => {
  const parser = new SimpleCmdParser();
  const program = await parser.parse('echo "Hello Plasmon" | grep Plasmon > result.txt');
  expect(program).toEqual({
    pipelines: [{
      commands: [
        { name: "echo", args: ["Hello Plasmon"] },
        { name: "grep", args: ["Plasmon"] },
      ],
      stdoutPath: "result.txt",
    }],
  });
  const run = transpileCmdToRun(program);
  expect(run).toContain('commands.echo(["Hello Plasmon"])');
  expect(run).toContain('commands.grep(["Plasmon"])');
  expect(run).toContain(']).writeTo("result.txt")');
  await expect(parser.parse("echo $HOME")).rejects.toThrow("does not support shell operator");
});

test("transpilation uses the catalog factory for every supported command", async () => {
  const program = await new SimpleCmdParser().parse("edit notes.txt\nman ls\nexit 0");
  const run = transpileCmdToRun(program);
  expect(run).toContain('commands.edit(["notes.txt"])');
  expect(run).toContain('commands.man(["ls"])');
  expect(run).toContain('commands.exit(["0"])');
  expect(run).not.toContain('commands.command("edit"');
});

test(".cmd preserves quoted paths with spaces for familiar filesystem commands", async () => {
  const parser = new SimpleCmdParser();
  const program = await parser.parse('mv "File Manager.sys" "MO.sys"');
  expect(program.pipelines[0]?.commands[0]).toEqual({ name: "mv", args: ["File Manager.sys", "MO.sys"] });
});

test("production OsApi and command session provide deterministic filesystem/open behavior", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    const output: string[] = [];
    const errors: string[] = [];
    const command = new CommandSession(env.os, {
      stdout: { write: (text) => output.push(text) },
      stderr: { write: (text) => errors.push(text) },
    });

    const redirected = await command.shell.pipeline([
      command.commands.echo(["Hello Plasmon"]),
    ]).writeTo("/Documents/hello.txt");
    expect(redirected.exitCode).toBe(0);
    expect(await env.os.fs.readText("/Documents/hello.txt")).toBe("Hello Plasmon\n");

    const piped = await command.shell.pipeline([
      command.commands.cat(["/Documents/hello.txt"]),
      command.commands.grep(["Plasmon"]),
    ]).run();
    expect(piped).toEqual({ exitCode: 0, stdout: "Hello Plasmon\n", stderr: "" });
    expect(output.at(-1)).toBe("Hello Plasmon\n");
    expect(errors).toEqual([]);

    const opened = await env.os.open("/Documents/hello.txt");
    expect(opened.resource.path).toBe("/Documents/hello.txt");
    expect(opened.processId).toBeDefined();
    expect(env.services.nativeApps.get("native:terminal")?.name).toBe("Terminal");
  } finally {
    env.dispose();
  }
});

test("transpileCmdFile creates a sibling .run without overwriting existing output", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    await env.os.fs.writeText("/Documents/demo.cmd", "echo Hello");
    const scripting = new ScriptingService({ os: env.os });
    const destination = await scripting.transpileCmdFile("/Documents/demo.cmd");
    expect(destination).toBe("/Documents/demo.run");
    expect(await env.os.fs.readText(destination)).toContain('commands.echo(["Hello"])');
    await expect(scripting.transpileCmdFile("/Documents/demo.cmd")).rejects.toThrow(
      "Refusing to overwrite existing /Documents/demo.run",
    );
  } finally {
    env.dispose();
  }
});

test("command catalog exposes the supported option/manual surface", () => {
  expect(shellCommandHelp("ls")?.options?.map((option) => option.flag)).toEqual(["-a", "-l", "-la", "-h"]);
  expect(shellCommandHelp("cat")?.options?.map((option) => option.flag)).toEqual(["-n"]);
  expect(shellCommandHelp("rm")?.options?.map((option) => option.flag)).toEqual(["-r", "-R", "-f"]);
  expect(shellCommandHelp("tee")?.options?.map((option) => option.flag)).toEqual(["-a"]);
  expect(renderShellHelp("ls")).toContain("OPTIONS");
  expect(renderShellHelp("ls")).toContain("-l");
  expect(renderShellHelp()).not.toContain("  true ");
  expect(renderShellHelp()).not.toContain("  false ");
});

test(".run/.cmd classification, taskbar default, and ambient declarations expose scripting", () => {
  const run = classifyResource({ name: "demo.run", kind: "file", metadata: {} });
  const cmd = classifyResource({ name: "demo.cmd", kind: "file", metadata: {} });
  expect(run.type.language).toBe("typescript");
  expect(cmd.type.language).toBe("shell");
  expect(DEFAULT_SHELL_PREFERENCES.pinnedNative).toContain("native:terminal");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("declare const os: RunOsApi");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("declare const commands: RunCommandFactory");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("declare const shell: RunShellApi");
  for (const commandName of SHELL_COMMAND_NAMES) {
    expect(RUN_CONTEXT_DECLARATIONS).toContain(`${commandName}(args?: readonly string[]): RunCommand;`);
  }
  expect(RUN_CONTEXT_DECLARATIONS).toContain("rename(path: string, newName: string)");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("openWith(path: string, handlerId: string)");
});
