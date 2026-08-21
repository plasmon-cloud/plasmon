import type { AppRegistryEntry } from "neutron-compiler/src/install.js";
import type { JsonObject } from "neutron-tools/protocol";
import { normalizeUntrustedText } from "neutron-tools/src/schema.js";

/**
 * Project one installed registry entry into the discovery-safe apps.describe
 * shape. Icon values are already normalized package-relative paths produced by
 * neutron-compiler during installation; preserving them here keeps package
 * identity authoritative without exposing executable paths or package bytes.
 */
export function describeInstalledAppMetadata(
  appId: string,
  app: AppRegistryEntry | undefined,
): JsonObject {
  if (!app) throw new Error(`Unknown app '${appId}'`);
  return {
    id: appId,
    name: safeDiscoveryText(app.name, 80),
    ...(app.description
      ? { description: safeDiscoveryText(app.description, 280) }
      : {}),
    version: app.version,
    tiles: app.tiles.map((tile) => ({
      id: tile.id,
      title: safeDiscoveryText(tile.title, 80),
      icon: tile.icon,
      ...(tile.description
        ? { description: safeDiscoveryText(tile.description, 280) }
        : {}),
    })),
    background: app.background
      ? {
          ...(app.background.description
            ? {
                description: safeDiscoveryText(
                  app.background.description,
                  280,
                ),
              }
            : {}),
        }
      : null,
    tray: app.tray
      ? {
          title: safeDiscoveryText(app.tray.title, 80),
          icon: app.tray.icon,
        }
      : null,
    untrustedMetadata: true,
  };
}

function safeDiscoveryText(value: string, maximum: number): string {
  return normalizeUntrustedText(value, "installed app metadata", {
    maximumLength: maximum,
  });
}
