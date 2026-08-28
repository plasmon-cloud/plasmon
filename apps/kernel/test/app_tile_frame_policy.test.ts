import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppTileFrameIframe } from "../src/workspace/AppTileFrameIframe.tsx";
import { APP_TILE_FRAME_SANDBOX } from "../src/workspace/app_tile_frame_policy.ts";

test("installed app tile frames permit downloads without broadening sandbox authority", () => {
  const tokens = new Set(APP_TILE_FRAME_SANDBOX.split(/\s+/).filter(Boolean));

  expect(tokens).toEqual(new Set(["allow-scripts", "allow-downloads"]));
  expect(tokens.has("allow-same-origin")).toBe(false);
  expect(tokens.has("allow-popups")).toBe(false);
  expect(tokens.has("allow-forms")).toBe(false);
});

test("iframe and response sandbox policies remain aligned", () => {
  const backendSource = readFileSync(
    new URL("../backend/main.mo", import.meta.url),
    "utf8",
  );
  const policyStart = backendSource.indexOf("public func appAssetSandboxHeaders");
  const policyEnd = backendSource.indexOf("public class Init", policyStart);
  expect(policyStart).toBeGreaterThanOrEqual(0);
  expect(policyEnd).toBeGreaterThan(policyStart);

  const policyFunction = backendSource.slice(policyStart, policyEnd);
  expect(policyFunction).toContain(
    `("Content-Security-Policy", "sandbox ${APP_TILE_FRAME_SANDBOX}")`,
  );
});

test("installed app tile frame renderer applies the canonical sandbox policy", () => {
  const html = renderToStaticMarkup(
    createElement(AppTileFrameIframe, {
      tile: {
        id: "instance-1",
        appId: "files",
        tileId: "main",
        title: "Files",
        path: "/",
        icon: "files",
      },
      runtimeIdentity: "1:0:1:https://files.example/",
      src: "https://files.example/",
      iframeRef: null,
      onLoad: () => {},
    }),
  );

  expect(html).toContain('sandbox="allow-scripts allow-downloads"');
  expect(html).not.toContain("allow-same-origin");
  expect(html).not.toContain("allow-popups");
  expect(html).not.toContain("allow-forms");
});
