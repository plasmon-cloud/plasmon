import type { FileOperationSnapshot } from "./operation-state.ts";

export interface FileOperationPresentation {
  running: boolean;
  message: string | null;
}

function itemCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function presentMove(operation: FileOperationSnapshot): FileOperationPresentation {
  if (operation.status === "running") {
    if (operation.currentIndex !== null) {
      return {
        running: true,
        message: `Moving ${operation.currentIndex} of ${operation.totalItems}${operation.currentItem ? `: ${operation.currentItem}` : ""}`,
      };
    }
    return {
      running: true,
      message: `Moving ${itemCount(operation.totalItems, "item")}…`,
    };
  }

  if (operation.status === "completed") {
    return { running: false, message: null };
  }

  if (operation.status === "failed") {
    const remaining = Math.max(0, operation.totalItems - operation.processedItems);
    const latestFailure = operation.failures.at(-1);
    if (operation.succeededItems === 0 && operation.failedItems === 0) {
      return {
        running: false,
        message: `Move failed before any items moved${latestFailure ? `: ${latestFailure.message}` : "."}`,
      };
    }
    const parts = [
      `${itemCount(operation.succeededItems, "item")} moved`,
      `${itemCount(operation.failedItems, "item")} failed`,
    ];
    if (remaining > 0) parts.push(`${itemCount(remaining, "item")} not moved`);
    return {
      running: false,
      message: `Move stopped: ${parts.join(", ")}${latestFailure ? ` (${latestFailure.item}: ${latestFailure.message})` : ""}.`,
    };
  }

  return { running: false, message: null };
}

export function presentFileOperation(operation: FileOperationSnapshot): FileOperationPresentation {
  if (!operation.kind) return { running: false, message: null };
  if (operation.kind === "move") return presentMove(operation);
  if (operation.status !== "running") return { running: false, message: null };

  if (operation.kind === "paste") {
    return {
      running: true,
      message: `Pasting ${itemCount(operation.totalItems, "item")}…`,
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
    message: `Importing ${itemCount(operation.totalItems, "item")}…`,
  };
}
