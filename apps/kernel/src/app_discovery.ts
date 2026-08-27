import type { AppRegistryEntry } from "neutron-compiler/src/install.js";
import type { JsonObject } from "neutron-tools/protocol";
import { normalizeUntrustedText } from "neutron-tools/src/schema.js";

function safeDiscoveryText(value: string, maximum: number): string {
  return normalizeUntrustedText(value, "installed app metadata", {
    maximumLength: maximum,
  });
}

/**
 * Installed registry icon paths are normalized by neutron-compiler to the
 * exact same-app `/app/<id>/...` route. apps.describe is a package descriptor
 * boundary, so project that trusted installed route back to its package-local
 * suffix rather than teaching app clients to accept arbitrary root-relative
 * URLs.
 */
export function installedIconDescriptorPath(
  appId: string,
  installedIcon: string,
): string {
  const prefix = `/app/${appId}/`;
  if (!installedIcon.startsWith(prefix) || installedIcon.length === prefix.length) {
    throw new Error("Invalid installed app metadata");
  }
  return installedIcon.slice(prefix.length);
}

export function describeInstalledAppMetadata(
  appId: string,
  app: AppRegistryEntry,
): JsonObject {
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
      icon: installedIconDescriptorPath(appId, tile.icon),
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
          icon: installedIconDescriptorPath(appId, app.tray.icon),
        }
      : null,
    untrustedMetadata: true,
  };
}
