import { createRoot } from "react-dom/client";
import { createFirstDemoSeeds } from "./demo/firstDemoFixture.ts";
import { reconcilePackagedDemoGameArtwork } from "./games/artwork.ts";
import { loadPackagedDemoGameSeeds } from "./games/demoFixture.ts";
import { installAppIconFallbacks } from "./iconFallback.ts";
import { PlasmonOS } from "./os/PlasmonOS.tsx";
import { createPlasmonServices } from "./os/integration/services.ts";
import "./style.scss";
import "./os/integration/visual-tokens.scss";

installAppIconFallbacks();

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

async function start(): Promise<void> {
  const pageUrl = window.location.href;
  const demoSeeds = [
    ...(await loadPackagedDemoGameSeeds(pageUrl)),
    ...createFirstDemoSeeds(pageUrl),
  ];
  const services = createPlasmonServices({ ...(demoSeeds.length > 0 ? { demoSeeds } : {}) });
  await reconcilePackagedDemoGameArtwork(services.fs);
  services.startMenu.start();
  createRoot(container).render(<PlasmonOS services={services} />);
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  container.textContent = `Plasmon failed to start: ${message}`;
  throw error;
});
