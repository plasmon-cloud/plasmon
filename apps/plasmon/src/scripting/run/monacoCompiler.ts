import { installMonacoEnvironment } from "../../native-apps/shared/monaco/monacoEnvironment.ts";
import type { RunCompileResult, RunCompiler } from "./compiler.ts";
import { ensureRunContextTypes } from "./monacoTypes.ts";

type DiagnosticLike = {
  code?: number;
  messageText?: unknown;
};

const COMPILER_STAGE_TIMEOUT_MS = 10_000;
let nextModelId = 0;
let configured = false;

function diagnosticMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "messageText" in value) {
    return diagnosticMessage((value as { messageText: unknown }).messageText);
  }
  return String(value);
}

function formatDiagnostic(diagnostic: DiagnosticLike): string {
  const prefix = diagnostic.code === undefined ? "TypeScript" : `TS${diagnostic.code}`;
  return `${prefix}: ${diagnosticMessage(diagnostic.messageText)}`;
}

async function withCompilerStageTimeout<T>(stage: string, operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`.run TypeScript compiler timed out during ${stage}`)),
          COMPILER_STAGE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Browser compiler adapter reusing the already-packaged Monaco TypeScript worker. */
export class MonacoRunCompiler implements RunCompiler {
  async compile(source: string, filename = "script.run"): Promise<RunCompileResult> {
    installMonacoEnvironment();
    const monaco = await withCompilerStageTimeout("Monaco module load", import("monaco-editor"));
    const defaults = monaco.languages.typescript.typescriptDefaults;
    ensureRunContextTypes(monaco);
    if (!configured) {
      defaults.setCompilerOptions({
        ...defaults.getCompilerOptions(),
        allowNonTsExtensions: true,
        noEmit: false,
        noEmitOnError: false,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        target: monaco.languages.typescript.ScriptTarget.ES2020,
      });
      configured = true;
    }

    const basename = filename.replaceAll("\\", "/").split("/").pop() || "script.run";
    const safeName = encodeURIComponent(basename.replace(/\.run$/u, ""));
    const uri = monaco.Uri.parse(`inmemory://plasmon-run/${++nextModelId}/${safeName}.ts`);
    const model = monaco.editor.createModel(source, "typescript", uri);
    try {
      const workerAccessor = await withCompilerStageTimeout(
        "TypeScript worker accessor startup",
        monaco.languages.typescript.getTypeScriptWorker(),
      );
      const worker = await withCompilerStageTimeout(
        "TypeScript worker connection",
        workerAccessor(uri),
      );
      const [syntactic, semantic, emit] = await withCompilerStageTimeout(
        "TypeScript diagnostics and emit",
        Promise.all([
          worker.getSyntacticDiagnostics(uri.toString()),
          worker.getSemanticDiagnostics(uri.toString()),
          worker.getEmitOutput(uri.toString()),
        ]),
      );
      const diagnostics = [...syntactic, ...semantic].map(formatDiagnostic);
      const javascript = emit.outputFiles.find((output) => output.name.endsWith(".js"))?.text ?? "";
      if (!javascript && diagnostics.length === 0) diagnostics.push("TypeScript worker emitted no JavaScript");
      return { javascript, diagnostics };
    } finally {
      model.dispose();
    }
  }
}
