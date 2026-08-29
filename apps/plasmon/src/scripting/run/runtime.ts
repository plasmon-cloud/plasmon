import type { ScriptOS } from "../os-api/types.ts";
import type { RunCompiler } from "./compiler.ts";

export interface RunExecutionResult {
  diagnostics: readonly string[];
}

let nextContextId = 0;

/** Execute real TypeScript after compilation, with only the implicit `os` binding added. */
export class RunRuntime {
  constructor(private readonly compiler: RunCompiler) {}

  async execute(source: string, os: ScriptOS, filename = "script.run"): Promise<RunExecutionResult> {
    const contextKey = `__plasmon_run_context_${++nextContextId}`;
    const wrapped = [
      `const os = (globalThis as any)[${JSON.stringify(contextKey)}] as RunOS;`,
      source,
    ].join("\n");
    const compiled = await this.compiler.compile(wrapped, filename);
    if (compiled.diagnostics.length > 0) {
      throw new Error(`.run TypeScript compilation failed:\n${compiled.diagnostics.join("\n")}`);
    }

    const host = globalThis as typeof globalThis & Record<string, unknown>;
    host[contextKey] = os;
    const blob = new Blob([compiled.javascript], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
      await import(url);
      return { diagnostics: compiled.diagnostics };
    } finally {
      URL.revokeObjectURL(url);
      delete host[contextKey];
    }
  }
}
