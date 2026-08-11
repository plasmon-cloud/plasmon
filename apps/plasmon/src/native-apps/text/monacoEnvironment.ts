export function monacoWorkerFile(label: string): string {
  if (label === "json") return "json.worker.js";
  if (label === "css" || label === "scss" || label === "less") return "css.worker.js";
  if (label === "html" || label === "handlebars" || label === "razor") return "html.worker.js";
  if (label === "typescript" || label === "javascript") return "ts.worker.js";
  return "editor.worker.js";
}
type MonacoEnvironmentShape = { getWorker?: (moduleId: string, label: string) => Worker; [key: string]: unknown; };
export function installMonacoEnvironment(target: typeof globalThis = globalThis): void {
  const scope = target as typeof globalThis & { MonacoEnvironment?: MonacoEnvironmentShape };
  if (scope.MonacoEnvironment?.getWorker) return;
  const current = scope.MonacoEnvironment ?? {};
  scope.MonacoEnvironment = { ...current, getWorker: (_moduleId: string, label: string) => new Worker(new URL(`./monaco-workers/${monacoWorkerFile(label)}`, import.meta.url), { type: "module", name: `plasmon-monaco-${label || "editor"}` }) };
}
