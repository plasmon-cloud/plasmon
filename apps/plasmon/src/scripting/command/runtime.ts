import type { OsApi } from "../os-api/types.ts";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunCommand {
  readonly name: string;
  readonly args: readonly string[];
}

export interface CommandFactory {
  command(name: string, args?: readonly string[]): RunCommand;
  cat(args?: readonly string[]): RunCommand;
  grep(args?: readonly string[]): RunCommand;
  echo(args?: readonly string[]): RunCommand;
  ls(args?: readonly string[]): RunCommand;
  pwd(args?: readonly string[]): RunCommand;
  cd(args?: readonly string[]): RunCommand;
  mkdir(args?: readonly string[]): RunCommand;
  open(args?: readonly string[]): RunCommand;
  help(args?: readonly string[]): RunCommand;
  true(args?: readonly string[]): RunCommand;
  false(args?: readonly string[]): RunCommand;
}

export interface CommandPipeline {
  run(): Promise<CommandResult>;
  writeTo(path: string): Promise<CommandResult>;
}

export interface ShellApi {
  pipeline(commands: readonly RunCommand[]): CommandPipeline;
}

export interface TextReader {
  read(): Promise<string>;
}

export interface TextWriter {
  write(text: string): void;
}

export interface CommandIo {
  stdin?: TextReader;
  stdout?: TextWriter;
  stderr?: TextWriter;
}

const SUPPORTED_COMMANDS = [
  "pwd", "cd", "ls", "cat", "echo", "mkdir", "grep", "open", "help", "true", "false",
] as const;

function result(exitCode: number, stdout = "", stderr = ""): CommandResult {
  return { exitCode, stdout, stderr };
}

export function resolveCommandPath(cwd: string, value: string): string {
  if (value.includes("\0")) throw new Error("Paths cannot contain NUL");
  const raw = value.startsWith("/") ? value : `${cwd}/${value}`;
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function commandFactory(name: string) {
  return (args: readonly string[] = []): RunCommand => ({ name, args: [...args] });
}

/** Stateful shell session above OsApi. cwd and command behavior never enter OsApi. */
export class CommandSession {
  readonly commands: CommandFactory;
  readonly shell: ShellApi;
  private cwdPath = "/";

  constructor(
    private readonly os: OsApi,
    private readonly io: CommandIo = {},
  ) {
    this.commands = {
      command: (name, args = []) => ({ name, args: [...args] }),
      cat: commandFactory("cat"),
      grep: commandFactory("grep"),
      echo: commandFactory("echo"),
      ls: commandFactory("ls"),
      pwd: commandFactory("pwd"),
      cd: commandFactory("cd"),
      mkdir: commandFactory("mkdir"),
      open: commandFactory("open"),
      help: commandFactory("help"),
      true: commandFactory("true"),
      false: commandFactory("false"),
    };
    this.shell = {
      pipeline: (commands) => ({
        run: () => this.runPipeline(commands),
        writeTo: (path) => this.runPipeline(commands, path),
      }),
    };
  }

  get cwd(): string {
    return this.cwdPath;
  }

  private path(value: string): string {
    return resolveCommandPath(this.cwdPath, value);
  }

  private async execute(command: RunCommand, input: string): Promise<CommandResult> {
    const argv = [...command.args];
    switch (command.name) {
      case "true":
        return result(0);
      case "false":
        return result(1);
      case "pwd":
        return argv.length === 0
          ? result(0, `${this.cwdPath}\n`)
          : result(2, "", "pwd: this experiment accepts no arguments\n");
      case "cd": {
        if (argv.length > 1) return result(2, "", "cd: expected zero or one path\n");
        const path = this.path(argv[0] ?? "/");
        try {
          const target = await this.os.fs.stat(path);
          if (target.kind !== "directory") return result(1, "", `cd: not a directory: ${path}\n`);
          this.cwdPath = target.path;
          return result(0);
        } catch (error) {
          return result(1, "", `cd: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "ls": {
        if (argv.length > 1) return result(2, "", "ls: expected zero or one path\n");
        if (argv[0]?.startsWith("-")) return result(2, "", "ls: options are not implemented in this experiment\n");
        try {
          const entries = await this.os.fs.list(this.path(argv[0] ?? this.cwdPath));
          return result(0, entries.map((entry) => `${entry.name}${entry.kind === "directory" ? "/" : ""}`).join("\n") + (entries.length ? "\n" : ""));
        } catch (error) {
          return result(1, "", `ls: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "cat": {
        if (argv.length === 0) return result(0, input);
        try {
          const chunks = await Promise.all(argv.map((path) => this.os.fs.readText(this.path(path))));
          return result(0, chunks.join(""));
        } catch (error) {
          return result(1, "", `cat: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "echo":
        return result(0, `${argv.join(" ")}\n`);
      case "mkdir": {
        if (argv.length === 0) return result(2, "", "mkdir: expected at least one path\n");
        try {
          for (const path of argv) await this.os.fs.createDirectory(this.path(path));
          return result(0);
        } catch (error) {
          return result(1, "", `mkdir: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "grep": {
        const [pattern, ...files] = argv;
        if (pattern === undefined) return result(2, "", "grep: expected a pattern\n");
        try {
          const text = files.length
            ? (await Promise.all(files.map((path) => this.os.fs.readText(this.path(path))))).join("\n")
            : input;
          const matches = text.split(/\r?\n/u).filter((line) => line.includes(pattern));
          return matches.length ? result(0, `${matches.join("\n")}\n`) : result(1);
        } catch (error) {
          return result(1, "", `grep: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "open": {
        if (argv.length !== 1) return result(2, "", "open: expected one path\n");
        try {
          await this.os.open(this.path(argv[0]!));
          return result(0);
        } catch (error) {
          return result(1, "", `open: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "help":
        return argv.length === 0
          ? result(0, `${SUPPORTED_COMMANDS.join(" ")}\n`)
          : result(2, "", "help: this experiment accepts no arguments\n");
      default:
        return result(127, "", `${command.name}: command not found\n`);
    }
  }

  private async runPipeline(commands: readonly RunCommand[], redirectPath?: string): Promise<CommandResult> {
    if (commands.length === 0) return result(0);
    let stdin = await this.io.stdin?.read() ?? "";
    let stderr = "";
    let exitCode = 0;
    for (const command of commands) {
      const executed = await this.execute(command, stdin);
      stdin = executed.stdout;
      stderr += executed.stderr;
      exitCode = executed.exitCode;
    }
    if (stderr) this.io.stderr?.write(stderr);
    if (redirectPath !== undefined) {
      await this.os.fs.writeText(this.path(redirectPath), stdin);
    } else if (stdin) {
      this.io.stdout?.write(stdin);
    }
    return result(exitCode, stdin, stderr);
  }
}
