import { createRoot } from "react-dom/client";
import { DesktopShell2 as DesktopShell } from "./desktop/DesktopShell.tsx";
import { installAppIconFallbacks } from "./iconFallback.ts";
import "./style.scss";
import "./desktop.scss";
import "./desktop-overrides.scss";

installAppIconFallbacks();

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");
createRoot(container).render(<DesktopShell />);
