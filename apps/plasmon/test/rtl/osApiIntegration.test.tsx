import { expect, test } from "bun:test";
import { act } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("RTL uses the same production OS API for legitimate setup and state inspection", async () => {
  const app = await renderPlasmon();

  try {
    await act(async () => {
      await app.environment.os.fs.writeText(
        "/Desktop/Created Through OS API.txt",
        "hello from env.os",
      );
    });

    expect(await app.findByRole("option", { name: "Created Through OS API.txt" })).toBeDefined();
    expect(await app.environment.os.fs.readText("/Desktop/Created Through OS API.txt")).toBe(
      "hello from env.os",
    );
  } finally {
    app.dispose();
  }
});
