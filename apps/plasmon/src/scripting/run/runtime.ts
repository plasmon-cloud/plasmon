import { CommandExit } from "../command/runtime.ts";
import type { RunCompiler } from "./compiler.ts";
import type { RunContext } from "./context.ts";

export interface RunExecutionResult {
  diagnostics: readonly string[];
  exitCode: number;
  terminated: boolean;
}

const MODULE_EXECUTION_TIMEOUT_MS = 10_000;
let nextContextId = 0;

async function withExecutionTimeout<T>(stage: string, operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`.run execution timed out during ${stage}`)),
          MODULE_EXECUTION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Execute ordinary TypeScript after compilation. The implicit bindings come
 * from RunContext; OsApi remains only the legitimate OS-capability surface.
 */
export class RunRuntime {
  constructor(private readonly compiler: RunCompiler) {}

  async execute(source: string, context: RunContext, filename = "script.run"): Promise<RunExecutionResult> {
    const contextKey = `__plasmon_run_context_${++nextContextId}`;
    const wrapped = [
      "export {};",
      `const __run = (globalThis as any)[${JSON.stringify(contextKey)}] as RunContext;`,
      "const { os, commands, shell, args, stdin, stdout, stderr, signal, print } = __run;",
      source,
    ].join("\n");
    const compiled = await this.compiler.compile(wrapped, filename);
    if (compiled.diagnostics.length > 0) {
      throw new Error(`.run TypeScript compilation failed:\n${compiled.diagnostics.join("\n")}`);
    }

    const host = globalThis as typeof globalThis & Record<string, unknown>;
    host[contextKey] = context;
    const blob = new Blob([compiled.javascript], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      try {
        await withExecutionTimeout("compiled module import", import(url));
        return { diagnostics: compiled.diagnostics, exitCode: 0, terminated: false };
      } catch (error) {
        if (error instanceof CommandExit) {
          return { diagnostics: compiled.diagnostics, exitCode: error.exitCode, terminated: true };
        }
        throw error;
      }
    } finally {
      URL.revokeObjectURL(url);
      delete host[contextKey];
    }
  }
}
