// @ts-ignore -- bun:test is available to the repository test runner but excluded from browser tsconfig globals.
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NativeAppIcon, ResourceIcon } from "./primitives.tsx";

test("native app presentation preserves developer artwork and contain sizing", () => {
  const markup = renderToStaticMarkup(<NativeAppIcon src="/apps/mail/static/icon.svg" />);
  expect(markup).toContain("/apps/mail/static/icon.svg");
  expect(markup).toContain("object-fit:contain");
});

test("native app presentation has a non-letter application fallback", () => {
  const markup = renderToStaticMarkup(<NativeAppIcon src={null} />);
  expect(markup).toContain("/static/plasmon/icons/application.svg");
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
  expect(markup).toContain("/static/plasmon/icons/application.svg");
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
  expect(markup).toContain("/static/plasmon/icons/shortcut-overlay.svg");
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
