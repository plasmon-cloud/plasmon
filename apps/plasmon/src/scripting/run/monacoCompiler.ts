import { installMonacoEnvironment } from "../../native-apps/shared/monaco/monacoEnvironment.ts";
import { RUN_CONTEXT_DECLARATIONS } from "../os-api/declarations.ts";
import type { RunCompileResult, RunCompiler } from "./compiler.ts";

type DiagnosticLike = {
  code?: number;
  messageText?: unknown;
};

let nextModelId = 0;
let configured = false;
let declarationsDisposable: { dispose(): void } | null = null;

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

/** Browser compiler adapter reusing the already-packaged Monaco TypeScript worker. */
export class MonacoRunCompiler implements RunCompiler {
  async compile(source: string, filename = "script.run"): Promise<RunCompileResult> {
    installMonacoEnvironment();
    const monaco = await import("monaco-editor");
    const defaults = monaco.languages.typescript.typescriptDefaults;
    if (!configured) {
      declarationsDisposable = defaults.addExtraLib(
        RUN_CONTEXT_DECLARATIONS,
        "inmemory://plasmon-run/run-context.d.ts",
      );
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
    void declarationsDisposable;

    const safeName = encodeURIComponent(filename.replace(/\.run$/u, ""));
    const uri = monaco.Uri.parse(`inmemory://plasmon-run/${++nextModelId}/${safeName}.ts`);
    const model = monaco.editor.createModel(source, "typescript", uri);
    try {
      const workerAccessor = await monaco.languages.typescript.getTypeScriptWorker();
      const worker = await workerAccessor(uri);
      const [syntactic, semantic, emit] = await Promise.all([
        worker.getSyntacticDiagnostics(uri.toString()),
        worker.getSemanticDiagnostics(uri.toString()),
        worker.getEmitOutput(uri.toString()),
      ]);
      const diagnostics = [...syntactic, ...semantic].map(formatDiagnostic);
      const javascript = emit.outputFiles.find((output) => output.name.endsWith(".js"))?.text ?? "";
      if (!javascript && diagnostics.length === 0) diagnostics.push("TypeScript worker emitted no JavaScript");
      return { javascript, diagnostics };
    } finally {
      model.dispose();
    }
  }
}
