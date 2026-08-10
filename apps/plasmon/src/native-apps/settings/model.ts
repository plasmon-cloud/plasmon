import type { FsNode, FsService } from "../../os/contracts/index.ts";
export interface StorageSummary { files: number; directories: number; bytes: number; unavailableReason?: string; }
export async function summarizeStorage(fs: FsService, startId?: string): Promise<StorageSummary> { try { const root = startId ? await fs.stat(startId) : await fs.resolvePath("/"); if (!root) return { files: 0, directories: 0, bytes: 0, unavailableReason: "Filesystem root is unavailable" }; let files = 0, directories = 0, bytes = 0; const pending: FsNode[] = [root]; while (pending.length) { const node = pending.pop()!; if (node.kind === "directory") { directories += 1; pending.push(...await fs.list(node.id)); } else { files += 1; bytes += node.size; } } return { files, directories, bytes }; } catch (error) { return { files: 0, directories: 0, bytes: 0, unavailableReason: error instanceof Error ? error.message : String(error) }; } }
export function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; const units = ["KB", "MB", "GB", "TB"]; let value = bytes / 1024; let unit = 0; while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; } return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unit]}`; }
export const settingsFeatureAvailability = [
  { id: "backup", label: "Backup", available: false, message: "Backup is not integrated in this Wave 2 build." },
  { id: "sharing", label: "Sharing", available: false, message: "Sharing is not integrated in this Wave 2 build." },
] as const;
