export const FILE_MANAGER_NAME = "File Manager";

export function fileManagerLocationLabel(path: string): string {
  if (path === "/") return "This Plasmon";
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export function fileManagerWindowTitle(path: string): string {
  return `${fileManagerLocationLabel(path)} — ${FILE_MANAGER_NAME}`;
}
