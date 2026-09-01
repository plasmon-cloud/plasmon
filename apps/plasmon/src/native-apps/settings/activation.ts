import type { ProcessController, ProcessId } from "../../os/contracts/index.ts";
import {
  createSettingsOpenTarget,
  type SettingsDestinationId,
} from "./model.ts";

export const SETTINGS_HANDLER_ID = "native:settings" as const;

export function activateSettings(
  process: ProcessController,
  destination?: SettingsDestinationId,
): Promise<ProcessId | null> {
  return process.open(
    SETTINGS_HANDLER_ID,
    destination === undefined ? createSettingsOpenTarget() : createSettingsOpenTarget(destination),
  );
}
