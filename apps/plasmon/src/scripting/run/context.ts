import type { OsApi } from "../../os/api/index.ts";
import type {
  CommandFactory,
  CommandSession,
  ShellApi,
  TextReader,
  TextWriter,
} from "../command/runtime.ts";

export interface RunContext {
  os: OsApi;
  commands: CommandFactory;
  shell: ShellApi;
  args: readonly string[];
  stdin: TextReader;
  stdout: TextWriter;
  stderr: TextWriter;
  signal: AbortSignal;
  print(...values: unknown[]): void;
}

export interface CreateRunContextOptions {
  args?: readonly string[];
  stdin: TextReader;
  stdout: TextWriter;
  stderr: TextWriter;
  signal: AbortSignal;
}

export function createRunContext(
  os: OsApi,
  commandSession: CommandSession,
  options: CreateRunContextOptions,
): RunContext {
  return {
    os,
    commands: commandSession.commands,
    shell: commandSession.shell,
    args: [...(options.args ?? [])],
    stdin: options.stdin,
    stdout: options.stdout,
    stderr: options.stderr,
    signal: options.signal,
    print: (...values) => options.stdout.write(`${values.map(String).join(" ")}\n`),
  };
}
