import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { renderPlasmon } from "../../renderPlasmon.tsx";

test("#113 Text window title identifies the document and editor", async () => {
  const rendered = await renderPlasmon();
  try {
    const documents = await rendered.environment.node("/Documents");
    if (!documents) throw new Error("Documents directory is unavailable");
    const file = await rendered.environment.services.fs.createFile(documents.id, "Parity.txt", { mime: "text/plain" });
    await rendered.environment.open(`/Documents/${file.name}`);
    await waitFor(() => {
      const process = rendered.environment.processes().find((entry) => entry.target.nodeId === file.id);
      expect(process?.title).toBe("Parity.txt - Monaco Editor");
    });
  } finally {
    rendered.dispose();
  }
});
