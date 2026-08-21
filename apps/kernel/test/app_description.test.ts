import { expect, test } from "bun:test";
import { describeInstalledAppMetadata } from "../src/app_description.ts";
import { registryApp } from "./app_registry_fixture.ts";

test("apps.describe preserves explicit normalized tile and tray icon paths", () => {
  const app = registryApp({
    id: "hackathon_icon",
    name: "Hackathon Icon",
    tiles: [
      {
        id: "main",
        title: "Hackathon Icon",
        path: "index.html",
        icon: "assets/hackathon-native-logo.svg",
      },
    ],
    tray: {
      title: "Hackathon Icon",
      path: "tray.html",
      icon: "assets/hackathon-tray.svg",
    },
  });

  expect(describeInstalledAppMetadata("hackathon_icon", app)).toEqual(
    expect.objectContaining({
      id: "hackathon_icon",
      tiles: [
        expect.objectContaining({
          id: "main",
          icon: "assets/hackathon-native-logo.svg",
        }),
      ],
      tray: expect.objectContaining({
        icon: "assets/hackathon-tray.svg",
      }),
    }),
  );
});

test("apps.describe preserves compiler-normalized default tile icon", () => {
  const app = registryApp({
    id: "default_icon",
    name: "Default Icon",
    tiles: [
      {
        id: "main",
        title: "Default Icon",
        path: "index.html",
      },
    ],
  });

  expect(describeInstalledAppMetadata("default_icon", app)).toEqual(
    expect.objectContaining({
      tiles: [
        expect.objectContaining({
          icon: "static/icon.png",
        }),
      ],
    }),
  );
});
