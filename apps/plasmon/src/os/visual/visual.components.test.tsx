// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NativeAppButton,
  NativeAppContentSurface,
  NativeAppPanel,
  NativeAppStateSurface,
  NativeAppStatusStrip,
  NativeAppToolbar,
} from "./native-app-chrome.tsx";
import { NativeAppIcon, PinIcon, ResourceIcon } from "./primitives.tsx";

test("native app presentation preserves developer artwork and contain sizing", () => {
  const markup = renderToStaticMarkup(<NativeAppIcon src="/apps/mail/static/icon.svg" />);
  expect(markup).toContain("/apps/mail/static/icon.svg");
  expect(markup).toContain("object-fit:contain");
});

test("native app presentation has a non-letter application fallback", () => {
  const markup = renderToStaticMarkup(<NativeAppIcon src={null} />);
  expect(markup).toContain("static/plasmon/icons/application.svg");
});

test("shared native app chrome preserves caller semantics and only adds presentation classes", () => {
  const markup = renderToStaticMarkup(
    <NativeAppContentSurface aria-label="Example app">
      <NativeAppToolbar as="nav" aria-label="Example controls">
        <NativeAppButton type="button">Run</NativeAppButton>
      </NativeAppToolbar>
      <NativeAppPanel aria-label="Example panel">Panel</NativeAppPanel>
      <NativeAppStateSurface tone="error" role="alert">Failed</NativeAppStateSurface>
      <NativeAppStatusStrip aria-label="Example status">Ready</NativeAppStatusStrip>
    </NativeAppContentSurface>,
  );

  expect(markup).toContain('class="plasmon-native-app-surface"');
  expect(markup).toContain('<nav aria-label="Example controls" class="plasmon-native-app-toolbar">');
  expect(markup).toContain('class="plasmon-native-app-button"');
  expect(markup).toContain('class="plasmon-native-app-panel"');
  expect(markup).toContain('role="alert" class="plasmon-native-app-state plasmon-native-app-state--error"');
  expect(markup).toContain('class="plasmon-native-app-status"');
});

test("shared pin presentation uses canonical artwork and structural pinned state", () => {
  const unpinned = renderToStaticMarkup(<PinIcon pinned={false} />);
  const pinned = renderToStaticMarkup(<PinIcon pinned />);

  expect(unpinned).toContain("static/plasmon/icons/pin.svg");
  expect(unpinned).toContain('data-pin-state="unpinned"');
  expect(unpinned).not.toContain("is-pinned");
  expect(pinned).toContain("static/plasmon/icons/pin.svg");
  expect(pinned).toContain('data-pin-state="pinned"');
  expect(pinned).toContain("plasmon-pin-icon is-pinned");
  expect(pinned).toContain("plasmon-pin-icon__state");
});

test("generic application presentation preserves handler artwork", () => {
  const markup = renderToStaticMarkup(
    <ResourceIcon
      context="file-list"
      presentation={{ kind: "application", src: "/apps/mail/static/icon.svg" }}
    />,
  );
  expect(markup).toContain("/apps/mail/static/icon.svg");
  expect(markup).toContain("object-fit:contain");
  expect(markup).toContain("data-icon-context=\"file-list\"");
});

test("generic application presentation uses the shared fallback when artwork is absent", () => {
  const markup = renderToStaticMarkup(
    <ResourceIcon context="file-list" presentation={{ kind: "application", src: null }} />,
  );
  expect(markup).toContain("static/plasmon/icons/application.svg");
});

test("resource shortcut keeps target artwork and adds only the lower-left overlay", () => {
  const markup = renderToStaticMarkup(
    <ResourceIcon
      context="desktop"
      shortcut
      presentation={{
        kind: "custom",
        content: <img src="/games/doom/icon.png" alt="" />,
      }}
    />,
  );
  expect(markup).toContain("/games/doom/icon.png");
  expect(markup).toContain("plasmon-custom-icon");
  expect(markup).toContain("static/plasmon/icons/shortcut-overlay.svg");
  expect(markup).toContain("--plasmon-icon-frame-size:var(--plasmon-icon-desktop-frame)");
  expect(markup).toContain("--plasmon-icon-art-size:var(--plasmon-icon-desktop-art)");
});

test("media thumbnail preserves source aspect ratio through contain", () => {
  const markup = renderToStaticMarkup(
    <ResourceIcon
      context="file-grid"
      presentation={{ kind: "thumbnail", src: "/photos/portrait.png", mediaKind: "image" }}
    />,
  );
  expect(markup).toContain("/photos/portrait.png");
  expect(markup).toContain("object-fit:contain");
  expect(markup).toContain("plasmon-icon-frame--thumbnail");
});