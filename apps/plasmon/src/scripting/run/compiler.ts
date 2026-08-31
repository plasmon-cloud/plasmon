export interface RunCompileResult {
  javascript: string;
  diagnostics: readonly string[];
}

/** TypeScript compiler boundary. Core .run execution does not depend on Monaco or Plasmon. */
export interface RunCompiler {
  compile(source: string, filename?: string): Promise<RunCompileResult>;
}
