import { useEffect, useState } from "react";
import type { WindowManager, WindowState } from "../contracts/window.ts";

export function useWindowStates(manager: WindowManager): readonly WindowState[] {
  const [windows, setWindows] = useState<readonly WindowState[]>(() => manager.list());

  useEffect(() => {
    const update = (): void => setWindows(manager.list());
    update();
    return manager.subscribe(update);
  }, [manager]);

  return windows;
}
