(() => {
  const CHANNEL = "plasmon-emulatorjs";
  const token = new URLSearchParams(window.location.search).get("token");
  let gameUrl = null;
  let terminating = false;

  const post = (phase, error) => {
    window.parent.postMessage({
      channel: CHANNEL,
      token,
      phase,
      error: error === undefined ? undefined : String(error),
    }, "*");
  };

  const fail = (reason) => {
    if (terminating) return;
    post("error", reason instanceof Error ? reason.message : reason || "EmulatorJS runtime error");
  };

  const disableBrowserPersistence = () => {
    // Kernel intentionally runs app documents in an allow-scripts sandbox with
    // an opaque origin. EmulatorJS 4.2.3 probes window.localStorage before it
    // checks EJS_disableLocalStorage, and its save-state storage still probes
    // IndexedDB even when EJS_disableDatabases is true. Shadow both browser
    // persistence capabilities inside this runtime instance instead of
    // weakening Kernel's sandbox or making browser storage authoritative.
    for (const name of ["localStorage", "indexedDB"]) {
      try {
        Object.defineProperty(window, name, {
          configurable: true,
          enumerable: true,
          value: null,
          writable: false,
        });
      } catch (error) {
        throw new Error(`Unable to isolate EmulatorJS ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const disableDeniedScreenWakeLock = () => {
    // The installed Neutron sandbox does not delegate screen-wake-lock to the
    // child runtime. Chromium still exposes navigator.wakeLock there, so
    // EmulatorJS 4.2.3 attempts request("screen") and lets the permissions-
    // policy rejection abort startup. Hide only that unavailable capability in
    // this child realm so EmulatorJS takes its normal no-wake-lock fallback;
    // do not grant the permission and do not fake a successful wake lock.
    if (!("wakeLock" in window.navigator)) return;

    try {
      let owner = window.navigator;
      while (owner && !Object.prototype.hasOwnProperty.call(owner, "wakeLock")) {
        owner = Object.getPrototypeOf(owner);
      }
      const descriptor = owner && Object.getOwnPropertyDescriptor(owner, "wakeLock");
      if (!owner || descriptor?.configurable !== true || !Reflect.deleteProperty(owner, "wakeLock")) {
        throw new Error("screen wake lock property cannot be masked");
      }
      if ("wakeLock" in window.navigator) {
        throw new Error("screen wake lock remains exposed after masking");
      }
    } catch (error) {
      throw new Error(`Unable to isolate EmulatorJS screen wake lock: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  window.addEventListener("error", (event) => {
    fail(event.error || event.message || "EmulatorJS runtime error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    fail(event.reason || "EmulatorJS promise rejection");
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.token !== token) return;

    if (message.command === "terminate") {
      terminating = true;
      try {
        window.EJS_terminate?.();
      } catch {
        // Parent teardown must continue even if the engine already stopped.
      }
      if (gameUrl) URL.revokeObjectURL(gameUrl);
      gameUrl = null;
      return;
    }

    if (message.command !== "init" || gameUrl) return;

    try {
      if (!(message.bytes instanceof ArrayBuffer)) {
        throw new Error("EmulatorJS host did not receive ROM bytes");
      }
      const gameName = typeof message.gameName === "string" && message.gameName
        ? message.gameName
        : "NES ROM";
      // Kernel executable app-host routes intentionally admit only URL-safe
      // path segments. Program Files remains the packaged runtime authority,
      // while this package-local mirror is the browser transport path.
      const dataRoot = new URL("./runtime/emulatorjs/data/", window.location.href).href;

      disableBrowserPersistence();
      disableDeniedScreenWakeLock();
      gameUrl = URL.createObjectURL(new Blob([message.bytes], { type: "application/octet-stream" }));
      window.EJS_player = "#game";
      window.EJS_core = "nes";
      window.EJS_gameUrl = gameUrl;
      window.EJS_gameName = gameName;
      window.EJS_pathtodata = dataRoot;
      window.EJS_startOnLoaded = true;
      window.EJS_threads = false;
      window.EJS_disableLocalStorage = true;
      window.EJS_disableDatabases = true;
      window.EJS_language = "en-US";
      window.EJS_disableAutoLang = false;
      window.EJS_ready = () => post("loaded");
      window.EJS_onGameStart = () => post("ready");
      window.EJS_onExit = () => {
        if (!terminating) fail("EmulatorJS runtime exited");
      };

      post("configured");
      const loader = document.createElement("script");
      loader.src = new URL("./runtime/emulatorjs/data/loader.js", window.location.href).href;
      loader.async = true;
      loader.dataset.plasmonRuntime = "emulatorjs";
      loader.addEventListener("error", () => fail("Unable to load packaged EmulatorJS runtime"), { once: true });
      document.head.append(loader);
      post("loader-injected");
    } catch (error) {
      fail(error);
    }
  });

  post("host-ready");
})();
