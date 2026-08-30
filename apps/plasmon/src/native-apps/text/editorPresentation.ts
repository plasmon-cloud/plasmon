const LANGUAGE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  plaintext: "Plain Text",
  javascript: "JavaScript",
  typescript: "TypeScript",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  markdown: "Markdown",
  xml: "XML",
  yaml: "YAML",
  shell: "Shell",
  python: "Python",
  rust: "Rust",
});

export function textEditorWindowTitle(name: string): string {
  const documentName = name.trim() || "Untitled";
  return `${documentName} - Monaco Editor`;
}

export function editorLanguageDisplayName(language: string, resourceName?: string): string {
  const lowerName = resourceName?.trim().toLowerCase() ?? "";
  if (lowerName.endsWith(".cmd")) return "Plasmon Command (.cmd)";
  if (lowerName.endsWith(".run")) return "Plasmon Run (.run)";
  const normalized = language.trim().toLowerCase();
  if (!normalized) return "Plain Text";
  return LANGUAGE_LABELS[normalized] ?? language;
}
