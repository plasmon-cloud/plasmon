import { createRoot } from "react-dom/client";
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
  const demoSeeds = await loadPackagedDemoGameSeeds(window.location.href);
  const services = createPlasmonServices({ ...(demoSeeds.length > 0 ? { demoSeeds } : {}) });
  createRoot(container).render(<PlasmonOS services={services} />);
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  container.textContent = `Plasmon failed to start: ${message}`;
  throw error;
});
