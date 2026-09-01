import { describe, expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../test/headlessEnvironment.ts";
import { SimpleCmdParser } from "./cmd/simple.ts";
import { transpileCmdToRun } from "./cmd/transpile.ts";
import { CommandExit, CommandSession, resolveCommandPath } from "./command/runtime.ts";
import { ScriptingService } from "./service.ts";

async function withSession(run: (session: CommandSession, env: ReturnType<typeof createHeadlessPlasmonEnvironment>) => Promise<void>) {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    await run(new CommandSession(env.os), env);
  } finally {
    env.dispose();
  }
}

describe(".cmd parser regression matrix", () => {
  test("preserves quoting, escaping, literal comment markers, comments, and blank lines", async () => {
    const program = await new SimpleCmdParser().parse([
      "# comment",
      "",
      "echo 'one two' \"three four\" five\\ six '#literal'",
      "  # indented comment",
      "echo done",
    ].join("\n"));

    expect(program.pipelines).toHaveLength(2);
    expect(program.pipelines[0]?.commands[0]).toEqual({
      name: "echo",
      args: ["one two", "three four", "five six", "#literal"],
    });
    expect(program.pipelines[1]?.commands[0]).toEqual({ name: "echo", args: ["done"] });
  });

  test("rejects every unsupported unquoted shell operator", async () => {
    const parser = new SimpleCmdParser();
    for (const operator of [";", "&", "<", "`", "$", "(", ")", "{", "}", "*"]) {
      await expect(parser.parse(`echo before ${operator} after`)).rejects.toThrow("does not support shell operator");
    }
  });

  test("allows unsupported operator characters when they are quoted literals", async () => {
    const program = await new SimpleCmdParser().parse("echo '$HOME' '*' ';' '<' '&'");
    expect(program.pipelines[0]?.commands[0]?.args).toEqual(["$HOME", "*", ";", "<", "&"]);
  });

  test("rejects malformed pipelines and redirections", async () => {
    const parser = new SimpleCmdParser();
    for (const source of [
      "| echo no",
      "echo no |",
      "echo no >",
      "echo no > one.txt two.txt",
      "echo no > one.txt > two.txt",
      "echo no || echo other",
    ]) {
      await expect(parser.parse(source)).rejects.toThrow();
    }
  });

  test("rejects incomplete escapes and unterminated quotes", async () => {
    const parser = new SimpleCmdParser();
    await expect(parser.parse("echo foo\\")).rejects.toThrow("incomplete escape");
    await expect(parser.parse("echo 'foo")).rejects.toThrow("unterminated single quote");
    await expect(parser.parse('echo "foo')).rejects.toThrow("unterminated double quote");
  });
});

describe(".cmd path and cwd behavior", () => {
  test("normalizes relative paths without baking cwd into scripts", () => {
    expect(resolveCommandPath("/Documents/Work", "../Notes/./a.txt")).toBe("/Documents/Notes/a.txt");
    expect(resolveCommandPath("/Documents", "//System///Program Files")).toBe("/System/Program Files");
    expect(() => resolveCommandPath("/", "bad\0name")).toThrow("NUL");
  });

  test("cd errors leave cwd unchanged and distinguish files from directories", async () => {
    await withSession(async (session, env) => {
      await env.os.fs.writeText("/Documents/not-a-dir.txt", "x");
      expect((await session.shell.pipeline([session.commands.cd(["/Documents"])]).run()).exitCode).toBe(0);
      expect(session.cwd).toBe("/Documents");

      const missing = await session.shell.pipeline([session.commands.cd(["missing"])]).run();
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toContain("no such directory");
      expect(session.cwd).toBe("/Documents");

      const file = await session.shell.pipeline([session.commands.cd(["not-a-dir.txt"])]).run();
      expect(file.exitCode).toBe(1);
      expect(file.stderr).toContain("not a directory");
      expect(session.cwd).toBe("/Documents");
    });
  });

  test("relative mutation and redirect paths follow the live session cwd", async () => {
    await withSession(async (session, env) => {
      await session.shell.pipeline([session.commands.cd(["/Documents"])]).run();
      await session.shell.pipeline([session.commands.mkdir(["Work"])]).run();
      await session.shell.pipeline([session.commands.cd(["Work"])]).run();
      await session.shell.pipeline([session.commands.echo(["hello"])]).writeTo("hello.txt");
      expect(await env.os.fs.readText("/Documents/Work/hello.txt")).toBe("hello\n");
    });
  });
});

describe(".cmd command option and error matrix", () => {
  test("ls supports combined -alh and rejects unknown flags", async () => {
    await withSession(async (session, env) => {
      await env.os.fs.writeText("/Documents/.secret", "1234");
      await env.os.fs.writeText("/Documents/public.txt", "1234567890");
      const plain = await session.shell.pipeline([session.commands.ls(["/Documents"])]).run();
      expect(plain.stdout).not.toContain(".secret");
      const detailed = await session.shell.pipeline([session.commands.ls(["-hla", "/Documents"])]).run();
      expect(detailed.stdout).toContain(".secret");
      expect(detailed.stdout).toContain("public.txt");
      const invalid = await session.shell.pipeline([session.commands.ls(["-z"])]).run();
      expect(invalid).toEqual({ exitCode: 2, stdout: "", stderr: "ls: unsupported option -z; try man ls\n" });
    });
  });

  test("cat -n numbers lines and unsupported options are explicit", async () => {
    await withSession(async (session, env) => {
      await env.os.fs.writeText("/Documents/lines.txt", "alpha\r\nbeta\n");
      const numbered = await session.shell.pipeline([session.commands.cat(["-n", "/Documents/lines.txt"])]).run();
      expect(numbered.stdout).toBe("     1\talpha\n     2\tbeta\n");
      expect((await session.shell.pipeline([session.commands.cat(["-x"])]).run()).exitCode).toBe(2);
    });
  });

  test("touch creates missing files, preserves existing contents, and rejects directories", async () => {
    await withSession(async (session, env) => {
      await env.os.fs.writeText("/Documents/existing.txt", "keep me");
      expect((await session.shell.pipeline([session.commands.touch(["/Documents/new.txt", "/Documents/existing.txt"])]).run()).exitCode).toBe(0);
      expect(await env.os.fs.readText("/Documents/new.txt")).toBe("");
      expect(await env.os.fs.readText("/Documents/existing.txt")).toBe("keep me");
      const directory = await session.shell.pipeline([session.commands.touch(["/Documents"])]).run();
      expect(directory.exitCode).toBe(1);
      expect(directory.stderr).toContain("is a directory");
    });
  });

  test("mkdir -p is idempotent and refuses a file as an intermediate directory", async () => {
    await withSession(async (session, env) => {
      expect((await session.shell.pipeline([session.commands.mkdir(["-p", "/Documents/a/b/c"])]).run()).exitCode).toBe(0);
      expect((await session.shell.pipeline([session.commands.mkdir(["-p", "/Documents/a/b/c"])]).run()).exitCode).toBe(0);
      await env.os.fs.writeText("/Documents/blocker", "x");
      const blocked = await session.shell.pipeline([session.commands.mkdir(["-p", "/Documents/blocker/child"])]).run();
      expect(blocked.exitCode).toBe(1);
      expect(blocked.stderr).toContain("not a directory");
    });
  });

  test("mv reports missing source, missing parent, and destination collisions without mutation", async () => {
    await withSession(async (session, env) => {
      const missing = await session.shell.pipeline([session.commands.mv(["/Documents/nope", "/Documents/new"])]).run();
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toContain("no such file or directory");

      await env.os.fs.writeText("/Documents/source.txt", "source");
      const missingParent = await session.shell.pipeline([session.commands.mv(["/Documents/source.txt", "/Documents/no-dir/new.txt"])]).run();
      expect(missingParent.exitCode).toBe(1);
      expect(await env.os.fs.readText("/Documents/source.txt")).toBe("source");

      await env.os.fs.writeText("/Documents/destination.txt", "destination");
      const collision = await session.shell.pipeline([session.commands.mv(["/Documents/source.txt", "/Documents/destination.txt"])]).run();
      expect(collision.exitCode).toBe(1);
      expect(collision.stderr).toContain("destination already exists");
      expect(await env.os.fs.readText("/Documents/source.txt")).toBe("source");
      expect(await env.os.fs.readText("/Documents/destination.txt")).toBe("destination");
    });
  });

  test("rm requires -r for directories and -f makes missing paths idempotent", async () => {
    await withSession(async (session, env) => {
      await env.os.fs.createDirectory("/Documents/remove-dir");
      await env.os.fs.writeText("/Documents/remove-dir/file.txt", "x");
      const noRecursive = await session.shell.pipeline([session.commands.rm(["/Documents/remove-dir"])]).run();
      expect(noRecursive.exitCode).toBe(1);
      expect(noRecursive.stderr).toContain("without -r");
      expect(await env.os.fs.exists("/Documents/remove-dir")).toBe(true);
      expect((await session.shell.pipeline([session.commands.rm(["-rf", "/Documents/remove-dir"])]).run()).exitCode).toBe(0);
      expect(await env.os.fs.exists("/Documents/remove-dir")).toBe(false);
      expect((await session.shell.pipeline([session.commands.rm(["-f", "/Documents/does-not-exist"])]).run()).exitCode).toBe(0);
    });
  });

  test("grep supports stdin/files, -i, -n, multi-file prefixes, and no-match status", async () => {
    await withSession(async (session, env) => {
      await env.os.fs.writeText("/Documents/a.txt", "Alpha\nbeta\n");
      await env.os.fs.writeText("/Documents/b.txt", "alpha two\ngamma\n");
      const stdin = await session.shell.pipeline([
        session.commands.echo(["HELLO"]),
        session.commands.grep(["-i", "hello"]),
      ]).run();
      expect(stdin.stdout).toBe("HELLO\n");
      const files = await session.shell.pipeline([session.commands.grep(["-in", "alpha", "/Documents/a.txt", "/Documents/b.txt"])]).run();
      expect(files.stdout).toBe("/Documents/a.txt:1:Alpha\n/Documents/b.txt:1:alpha two\n");
      expect((await session.shell.pipeline([session.commands.grep(["missing", "/Documents/a.txt"])]).run()).exitCode).toBe(1);
    });
  });

  test("head and tail cover defaults, zero count, files, stdin, and invalid counts", async () => {
    await withSession(async (session, env) => {
      const lines = Array.from({ length: 12 }, (_, index) => `L${index + 1}`).join("\n") + "\n";
      await env.os.fs.writeText("/Documents/twelve.txt", lines);
      const head = await session.shell.pipeline([session.commands.head(["/Documents/twelve.txt"])]).run();
      expect(head.stdout).toContain("L10\n");
      expect(head.stdout).not.toContain("L11\n");
      const tail = await session.shell.pipeline([session.commands.tail(["-n", "2", "/Documents/twelve.txt"])]).run();
      expect(tail.stdout).toBe("L11\nL12\n");
      const zero = await session.shell.pipeline([session.commands.echo(["x"]), session.commands.head(["-n", "0"])]).run();
      expect(zero.stdout).toBe("");
      expect((await session.shell.pipeline([session.commands.head(["-n", "nope"])]).run()).exitCode).toBe(2);
    });
  });

  test("wc, sort, uniq, and tee option behavior composes predictably", async () => {
    await withSession(async (session, env) => {
      const wc = await session.shell.pipeline([session.commands.echo(["one", "two"]), session.commands.wc(["-lwc"])]).run();
      expect(wc.stdout).toBe("1 2 8\n");
      const sorted = await session.shell.pipeline([session.commands.echo(["a\\nc\\nb"]), session.commands.sort(["-r"])]).run();
      expect(sorted.exitCode).toBe(0);

      const uniq = await session.shell.pipeline([session.commands.uniq(["-c"])]).run();
      expect(uniq.stdout).toBe("");

      await env.os.fs.writeText("/Documents/tee.txt", "before\n");
      const tee = await session.shell.pipeline([session.commands.echo(["after"]), session.commands.tee(["-a", "/Documents/tee.txt"])]).run();
      expect(tee.stdout).toBe("after\n");
      expect(await env.os.fs.readText("/Documents/tee.txt")).toBe("before\nafter\n");
    });
  });

  test("unknown commands, argument arity, and exit status validation use shell-like statuses", async () => {
    await withSession(async (session) => {
      const unknown = await session.shell.pipeline([session.commands.command("definitely-not-a-command")]).run();
      expect(unknown.exitCode).toBe(127);
      expect(unknown.stderr).toContain("command not found");
      expect((await session.shell.pipeline([session.commands.pwd(["extra"])]).run()).exitCode).toBe(2);
      expect((await session.shell.pipeline([session.commands.ps(["extra"])]).run()).exitCode).toBe(2);

      for (const args of [["-1"], ["256"], ["abc"], ["1", "2"]]) {
        try {
          await session.shell.pipeline([session.commands.exit(args)]).run();
          throw new Error("invalid exit must terminate with status 2");
        } catch (error) {
          expect(error).toBeInstanceOf(CommandExit);
          expect((error as CommandExit).exitCode).toBe(2);
        }
      }
    });
  });
});

describe(".cmd/.run service and transpiler regressions", () => {
  test("multiple pipelines transpile to readable sequential fail-fast TypeScript", async () => {
    const program = await new SimpleCmdParser().parse("echo one\nfalse\necho never");
    const run = transpileCmdToRun(program);
    expect(run).toContain("const __cmdResult0");
    expect(run).toContain("const __cmdResult1");
    expect(run).toContain("const __cmdResult2");
    expect(run.match(/exitCode !== 0/gu)).toHaveLength(3);
    expect(run).not.toContain("/Documents");
  });

  test("redirection transpiles through pipeline.writeTo instead of an OS API shortcut", async () => {
    const run = transpileCmdToRun(await new SimpleCmdParser().parse("echo hello > out.txt"));
    expect(run).toContain(']).writeTo("out.txt")');
    expect(run).not.toContain("os.fs.writeText");
  });

  test("transpileCmdFile accepts .CMD case-insensitively, rejects other types, and never overwrites", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const service = new ScriptingService({ os: env.os });
      await env.os.fs.writeText("/Documents/UPPER.CMD", "echo upper");
      expect(await service.transpileCmdFile("/Documents/UPPER.CMD")).toBe("/Documents/UPPER.run");
      expect(await env.os.fs.readText("/Documents/UPPER.run")).toContain("commands.echo");
      await expect(service.transpileCmdFile("/Documents/UPPER.CMD")).rejects.toThrow("Refusing to overwrite");
      await env.os.fs.writeText("/Documents/plain.txt", "echo nope");
      await expect(service.transpileCmdFile("/Documents/plain.txt")).rejects.toThrow("Only .cmd files");
    } finally {
      env.dispose();
    }
  });
});
