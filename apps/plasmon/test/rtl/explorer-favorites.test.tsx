import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("File Explorer Favorites use shared themed icons and canonical Apps navigation", async () => {
  const app = await renderPlasmon();
  try {
    await act(async () => {
      await app.environment.os.open("/Documents");
    });

    const explorer = await app.findByRole("region", { name: "File Explorer" });
    const favorites = within(explorer).getByRole("complementary", { name: "Favorites" });
    const favoriteView = within(favorites);
    const documentsButton = await favoriteView.findByRole("button", { name: "Documents" });
    const appsButton = await favoriteView.findByRole("button", { name: "Apps" });

    expect(documentsButton.querySelector('[data-plasmon-owned-icon="file-type:folder"]')).not.toBeNull();
    expect(appsButton.querySelector('[data-plasmon-owned-icon="system:application"]')).not.toBeNull();
    expect(favoriteView.queryByText("▰")).toBeNull();
    await waitFor(() => expect(documentsButton.getAttribute("aria-current")).toBe("page"));
    expect(appsButton.getAttribute("aria-current")).toBeNull();

    await app.user.click(appsButton);

    await waitFor(() => {
      const address = within(explorer).getByRole("textbox", { name: "Address" }) as HTMLInputElement;
      expect(address.value).toBe("/Apps");
      expect(appsButton.getAttribute("aria-current")).toBe("page");
    });
  } finally {
    app.dispose();
  }
});
