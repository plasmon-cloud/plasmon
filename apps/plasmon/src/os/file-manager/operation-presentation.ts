import type { FileOperationSnapshot } from "./operation-state.ts";

export interface FileOperationPresentation {
  running: boolean;
  message: string | null;
}

export function presentFileOperation(operation: FileOperationSnapshot): FileOperationPresentation {
  if (operation.status !== "running" || !operation.kind) {
    return { running: false, message: null };
  }

  if (operation.kind === "paste") {
    return {
      running: true,
      message: `Pasting ${operation.totalItems} ${operation.totalItems === 1 ? "item" : "items"}…`,
    };
  }

  if (operation.kind === "move") {
    if (operation.currentIndex !== null) {
      return {
        running: true,
        message: `Moving ${operation.currentIndex} of ${operation.totalItems}${operation.currentItem ? `: ${operation.currentItem}` : ""}`,
      };
    }
    return {
      running: true,
      message: `Moving ${operation.totalItems} ${operation.totalItems === 1 ? "item" : "items"}…`,
    };
  }

  if (operation.currentIndex !== null) {
    return {
      running: true,
      message: `Importing ${operation.currentIndex} of ${operation.totalItems}${operation.currentItem ? `: ${operation.currentItem}` : ""}`,
    };
  }

  return {
    running: true,
    message: `Importing ${operation.totalItems} ${operation.totalItems === 1 ? "item" : "items"}…`,
  };
}
