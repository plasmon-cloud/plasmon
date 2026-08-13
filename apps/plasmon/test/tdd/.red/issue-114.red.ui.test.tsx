import { expect, test } from "bun:test";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("#114 Markdown exposes a formatter command in its native toolbar", async () => {
  const rendered = await renderPlasmon();
  try {
    const documents = await rendered.environment.node("/Documents");
    if (!documents) throw new Error("Documents directory is unavailable");
    const file = await rendered.environment.services.fs.createFile(documents.id, "Parity.md", { mime: "text/markdown" });
    await rendered.environment.open(`/Documents/${file.name}`);
    expect(rendered.getByRole("button", { name: "Format Markdown", exact: true })).toBeDefined();
  } finally {
    rendered.dispose();
  }
});
