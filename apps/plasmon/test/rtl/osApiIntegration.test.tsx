import { expect, test } from "bun:test";
import { act } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("RTL uses the same production OsApi for legitimate setup and state inspection", async () => {
  const app = await renderPlasmon();

  try {
    await act(async () => {
      await app.environment.os.fs.writeText("/Desktop/Created Through OsApi.txt", "hello from env.os");
    });

    expect(await app.findByRole("option", { name: "Created Through OsApi.txt" })).toBeDefined();
    expect(await app.environment.os.fs.readText("/Desktop/Created Through OsApi.txt")).toBe(
      "hello from env.os",
    );
  } finally {
    app.dispose();
  }
});
