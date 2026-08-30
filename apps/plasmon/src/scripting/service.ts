import type { OsApi } from "../os/api/index.ts";
import type { CmdParser } from "./cmd/types.ts";
import { SimpleCmdParser } from "./cmd/simple.ts";
import { transpileCmdToRun } from "./cmd/transpile.ts";
import {
  CommandSession,
  type TextReader,
  type TextWriter,
} from "./command/runtime.ts";
import type { RunCompiler } from "./run/compiler.ts";
import { createRunContext } from "./run/context.ts";
import { MonacoRunCompiler } from "./run/monacoCompiler.ts";
import { RunRuntime } from "./run/runtime.ts";

export interface ScriptingSessionOptions {
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  stdin?: () => string | Promise<string>;
  clear?: () => void;
}

export interface ScriptExecutionResult {
  diagnostics: readonly string[];
  exitCode: number;
  terminated: boolean;
}

export interface CmdExecutionResult extends ScriptExecutionResult {
  runSource: string;
}

export interface ScriptingServiceOptions {
  os: OsApi;
  parser?: CmdParser;
  compiler?: RunCompiler;
}

export class ScriptingSession {
  private readonly commands: CommandSession;
  private readonly stdout: TextWriter;
  private readonly stderr: TextWriter;
  private readonly stdin: TextReader;
  private activeAbort: AbortController | null = null;

  constructor(
    private readonly os: OsApi,
    private readonly parser: CmdParser,
    private readonly runtime: RunRuntime,
    options: ScriptingSessionOptions,
  ) {
    this.stdout = { write: (text) => options.stdout?.(text) };
    this.stderr = { write: (text) => options.stderr?.(text) };
    this.stdin = { read: async () => String(await options.stdin?.() ?? "") };
    this.commands = new CommandSession(os, {
      stdin: this.stdin,
      stdout: this.stdout,
      stderr: this.stderr,
      clear: options.clear,
    });
  }

  get cwd(): string {
    return this.commands.cwd;
  }

  cancel(): void {
    this.activeAbort?.abort();
  }

  private async executeRunSource(source: string, filename: string): Promise<ScriptExecutionResult> {
    const abort = new AbortController();
    this.activeAbort = abort;
    try {
      const execution = await this.runtime.execute(
        source,
        createRunContext(this.os, this.commands, {
          stdin: this.stdin,
          stdout: this.stdout,
          stderr: this.stderr,
          signal: abort.signal,
        }),
        filename,
      );
      return execution;
    } finally {
      if (this.activeAbort === abort) this.activeAbort = null;
    }
  }

  async executeCmd(source: string, filename = "terminal.cmd"): Promise<CmdExecutionResult> {
    this.commands.recordHistory(source);
    const program = await this.parser.parse(source, filename);
    const runSource = transpileCmdToRun(program);
    const execution = await this.executeRunSource(runSource, filename.replace(/\.cmd$/u, ".run"));
    return { runSource, ...execution };
  }

  async executeRun(source: string, filename = "script.run"): Promise<ScriptExecutionResult> {
    return this.executeRunSource(source, filename);
  }
}

/** Production scripting composition above OsApi; no React or test authority lives here. */
export class ScriptingService {
  readonly os: OsApi;
  private readonly parser: CmdParser;
  private readonly runtime: RunRuntime;

  constructor(options: ScriptingServiceOptions) {
    this.os = options.os;
    this.parser = options.parser ?? new SimpleCmdParser();
    this.runtime = new RunRuntime(options.compiler ?? new MonacoRunCompiler());
  }

  createSession(options: ScriptingSessionOptions = {}): ScriptingSession {
    return new ScriptingSession(this.os, this.parser, this.runtime, options);
  }

  async transpileCmd(source: string, filename = "script.cmd"): Promise<string> {
    return transpileCmdToRun(await this.parser.parse(source, filename));
  }

  async transpileCmdFile(path: string): Promise<string> {
    if (!path.toLowerCase().endsWith(".cmd")) throw new Error("Only .cmd files can be transpiled to .run");
    const destination = `${path.slice(0, -4)}.run`;
    if (await this.os.fs.exists(destination)) throw new Error(`Refusing to overwrite existing ${destination}`);
    const source = await this.os.fs.readText(path);
    const runSource = await this.transpileCmd(source, path);
    await this.os.fs.writeText(destination, runSource);
    return destination;
  }
}
