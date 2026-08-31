import { describe, expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../../test/headlessEnvironment.ts";
import { SimpleCmdParser } from "../cmd/simple.ts";
import { transpileCmdToRun } from "../cmd/transpile.ts";
import { CommandExit, CommandSession } from "./runtime.ts";

describe(".cmd command surface", () => {
  test("cp, mv, and rm delegate to canonical Plasmon filesystem semantics", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const source = await env.os.fs.writeText("/Documents/v1-transfer.txt", "transfer value");
      await env.os.fs.createDirectory("/Documents/V1 Copy Target");
      await env.os.fs.createDirectory("/Documents/V1 Move Target");
      const session = new CommandSession(env.os);

      const copiedResult = await session.shell.pipeline([
        session.commands.cp([source.path, "/Documents/V1 Copy Target"]),
      ]).run();
      expect(copiedResult.exitCode).toBe(0);
      const copied = await env.os.fs.stat("/Documents/V1 Copy Target/v1-transfer.txt");
      expect(copied).not.toBeNull();
      expect(copied?.id).not.toBe(source.id);
      expect(await env.os.fs.readText("/Documents/V1 Copy Target/v1-transfer.txt")).toBe("transfer value");

      const movedResult = await session.shell.pipeline([
        session.commands.mv([source.path, "/Documents/V1 Move Target"]),
      ]).run();
      expect(movedResult.exitCode).toBe(0);
      const movedPath = "/Documents/V1 Move Target/v1-transfer.txt";
      const moved = await env.os.fs.stat(movedPath);
      expect(moved?.id).toBe(source.id);
      expect(await env.os.fs.exists(source.path)).toBe(false);

      const removedResult = await session.shell.pipeline([
        session.commands.rm([movedPath]),
      ]).run();
      expect(removedResult.exitCode).toBe(0);
      expect(await env.os.fs.exists(movedPath)).toBe(false);
      const trashEntries = await env.services.filesystem.trash.list();
      expect(trashEntries.some((entry) => entry.node.id === source.id && entry.originalPath === movedPath)).toBe(true);
    } finally {
      env.dispose();
    }
  });

  test("buffered text commands compose through pipes and tee", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      await env.os.fs.writeText("/Documents/v1-lines.txt", "c\nb\nb\na\n");
      const session = new CommandSession(env.os);
      const piped = await session.shell.pipeline([
        session.commands.cat(["/Documents/v1-lines.txt"]),
        session.commands.head(["-n", "4"]),
        session.commands.sort([]),
        session.commands.uniq([]),
        session.commands.tail(["-n", "2"]),
        session.commands.tee(["/Documents/v1-tee.txt"]),
        session.commands.wc(["-l"]),
      ]).run();

      expect(piped).toEqual({ exitCode: 0, stdout: "2\n", stderr: "" });
      expect(await env.os.fs.readText("/Documents/v1-tee.txt")).toBe("b\nc\n");

      const counted = await session.shell.pipeline([
        session.commands.echo(["one", "two", "three"]),
        session.commands.wc(["-w"]),
      ]).run();
      expect(counted.stdout).toBe("3\n");
    } finally {
      env.dispose();
    }
  });

  test("ps, history, clear, and exit remain session/runtime behavior above OsApi", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      await env.os.open("/Documents");
      let clears = 0;
      const session = new CommandSession(env.os, { clear: () => { clears += 1; } });
      session.recordHistory("pwd");
      session.recordHistory("history");

      const ps = await session.shell.pipeline([session.commands.ps([])]).run();
      expect(ps.stdout).toContain("PID\tSTATE\tAPP\tTITLE");
      expect(ps.stdout).toContain("native:explorer");

      const history = await session.shell.pipeline([session.commands.history([])]).run();
      expect(history.stdout).toBe("1\tpwd\n2\thistory\n");

      expect((await session.shell.pipeline([session.commands.clear([])]).run()).exitCode).toBe(0);
      expect(clears).toBe(1);

      try {
        await session.shell.pipeline([session.commands.exit(["7"])]).run();
        throw new Error("exit should terminate command execution");
      } catch (error) {
        expect(error).toBeInstanceOf(CommandExit);
        expect((error as CommandExit).exitCode).toBe(7);
      }
    } finally {
      env.dispose();
    }
  });

  test("shell options, touch, rename-style mv, and manuals behave consistently", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const session = new CommandSession(env.os);
      expect((await session.shell.pipeline([session.commands.mkdir(["-p", "/Documents/a/b"])]).run()).exitCode).toBe(0);
      expect((await session.shell.pipeline([session.commands.touch(["/Documents/a/b/hello.txt"])]).run()).exitCode).toBe(0);
      await env.os.fs.writeText("/Documents/.hidden.txt", "hidden");

      const visible = await session.shell.pipeline([session.commands.ls(["/Documents"])]).run();
      expect(visible.stdout).not.toContain(".hidden.txt");
      const detailed = await session.shell.pipeline([session.commands.ls(["-lah", "/Documents"])]).run();
      expect(detailed.stdout).toContain(".hidden.txt");
      expect(detailed.stdout).toContain("a/");

      const moved = await session.shell.pipeline([session.commands.mv(["/Documents/a/b/hello.txt", "/Documents/a/b/renamed.txt"])]).run();
      expect(moved.exitCode).toBe(0);
      expect(await env.os.fs.exists("/Documents/a/b/hello.txt")).toBe(false);
      expect(await env.os.fs.exists("/Documents/a/b/renamed.txt")).toBe(true);

      const manual = await session.shell.pipeline([session.commands.man(["ls"])]).run();
      expect(manual.stdout).toContain("ls [-alh] [PATH]");
      const help = await session.shell.pipeline([session.commands.help([])]).run();
      expect(help.stdout).toContain("Commands are silent on success");
      expect(help.stdout).not.toMatch(/^.*true.*false.*$/m);
    } finally {
      env.dispose();
    }
  });

  test("transpiler emits readable factories and fail-fast checks for supported commands", async () => {
    const program = await new SimpleCmdParser().parse(
      "cp source.txt /Documents\ncat source.txt | head -n 1 | tee first.txt\nexit 3",
    );
    const run = transpileCmdToRun(program);
    expect(run).toContain('commands.cp(["source.txt","/Documents"])');
    expect(run).toContain('commands.head(["-n","1"])');
    expect(run).toContain('commands.tee(["first.txt"])');
    expect(run).toContain('commands.exit(["3"])');
    expect(run).toContain("if (__cmdResult0.exitCode !== 0)");
    expect(run).toContain("commands.exit([String(__cmdResult0.exitCode)])");
  });
});
