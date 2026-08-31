import { RUN_CONTEXT_DECLARATIONS } from "../os-api/declarations.ts";

type MonacoApi = typeof import("monaco-editor");

let installed = false;
let extraLib: { dispose(): void } | null = null;

/** Install ambient RunContext types once per browser realm. */
export function ensureRunContextTypes(monaco: MonacoApi): void {
  if (installed) return;
  extraLib = monaco.languages.typescript.typescriptDefaults.addExtraLib(
    RUN_CONTEXT_DECLARATIONS,
    "inmemory://plasmon-run/run-context.d.ts",
  );
  installed = true;
  void extraLib;
}
