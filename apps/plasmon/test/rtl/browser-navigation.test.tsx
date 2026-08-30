import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Browser launcher supports Go and Enter navigation with bounded invalid-input feedback", async () => {
  const app = await renderPlasmon();

  try {
    await app.environment.os.open("/System/Browser.sys");

    const address = await app.findByRole("textbox", { name: "Web address" });
    expect(app.getByText("Enter an http:// or https:// address to browse.")).toBeDefined();
    expect(app.queryByRole("alert")).toBeNull();

    await app.user.type(address, "https://example.com");
    await app.user.click(app.getByRole("button", { name: "Go" }));

    const firstFrame = await app.findByTitle("example.com");
    expect(firstFrame.getAttribute("src")).toBe("https://example.com/");
    let browserProcess = app.environment.services.process.list().find(
      (process) => process.handlerId === "native:browser",
    );
    expect(browserProcess?.target).toEqual({ url: "https://example.com/" });

    await app.user.clear(address);
    await app.user.type(address, "https://example.org{Enter}");

    const secondFrame = await app.findByTitle("example.org");
    expect(secondFrame.getAttribute("src")).toBe("https://example.org/");
    browserProcess = app.environment.services.process.list().find(
      (process) => process.handlerId === "native:browser",
    );
    expect(browserProcess?.target).toEqual({ url: "https://example.org/" });

    await app.user.clear(address);
    await app.user.type(address, "ftp://example.net{Enter}");

    const alert = await app.findByRole("alert");
    expect(alert.textContent).toContain("Enter a complete http:// or https:// URL");
    await waitFor(() => {
      const current = app.environment.services.process.list().find(
        (process) => process.handlerId === "native:browser",
      );
      expect(current?.target).toEqual({ url: "https://example.org/" });
    });
  } finally {
    app.dispose();
  }
});
