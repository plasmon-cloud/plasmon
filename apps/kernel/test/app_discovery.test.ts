import { expect, test } from "bun:test";
import type { AppRegistryEntry } from "neutron-compiler/src/install.js";
import {
  describeInstalledAppMetadata,
  installedIconDescriptorPath,
} from "../src/app_discovery.ts";
import { registryApp } from "./app_registry_fixture.ts";

test("apps.describe projects authoritative installed tile and tray icons to package-relative paths", () => {
  const app = registryApp({
    id: "hackathon_icon",
    name: "Hackathon Icon",
    background: {
      path: "service.html",
      description: "Installed icon authority fixture",
    },
    tiles: [
      {
        id: "main",
        title: "Hackathon Icon",
        path: "index.html",
        icon: "assets/hackathon-native-logo.svg",
      },
    ],
    tray: {
      title: "Hackathon Icon Tray",
      path: "tray.html",
      icon: "assets/hackathon-native-tray.svg",
    },
  });

  expect(describeInstalledAppMetadata("hackathon_icon", app)).toMatchObject({
    id: "hackathon_icon",
    tiles: [
      {
        id: "main",
        icon: "assets/hackathon-native-logo.svg",
      },
    ],
    tray: {
      icon: "assets/hackathon-native-tray.svg",
    },
  });
});

test("apps.describe preserves the schema-defined tile icon default instead of compatibility guessing", () => {
  const app = registryApp({
    id: "default_icon",
    name: "Default Icon",
    tiles: [{ id: "main", title: "Default Icon", path: "index.html" }],
  });

  expect(describeInstalledAppMetadata("default_icon", app)).toMatchObject({
    tiles: [{ icon: "static/icon.png" }],
  });
});

test("apps.describe rejects an installed icon outside the exact app route", () => {
  const app = registryApp({
    id: "safe_app",
    name: "Safe App",
    tiles: [{ id: "main", title: "Safe App", path: "index.html" }],
  });
  const poisoned = {
    ...app,
    tiles: app.tiles.map((tile) => ({
      ...tile,
      icon: "/app/other_app/assets/stolen.svg",
    })),
  } as AppRegistryEntry;

  expect(() => describeInstalledAppMetadata("safe_app", poisoned)).toThrow(
    "Invalid installed app metadata",
  );
  expect(() =>
    installedIconDescriptorPath("safe_app", "/app/safe_app/"),
  ).toThrow("Invalid installed app metadata");
});
