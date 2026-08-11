import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { cx, nt } from "neutron-design-system";
import {
  createCanisterClient,
  loadNeutronCanisterId,
  loadTileContext,
  type JsonValue,
  type MethodSchemaJson,
  type NeutronCanisterClient,
} from "neutron-tools/app";
import "./style.scss";

const HELLO_METHOD = "hello_world";

function formatResult(value: JsonValue): string {
  return JSON.stringify(value);
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const App = () => {
  const [client, setClient] = useState<NeutronCanisterClient | null>(null);
  const [methodSchema, setMethodSchema] = useState<MethodSchemaJson | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [tileContext] = useState(() => loadTileContext());

  useEffect(() => {
    let cancelled = false;
    loadNeutronCanisterId()
      .then(async (id) => {
        const nextClient = createCanisterClient(id);
        const schema = await nextClient.methodSchema(HELLO_METHOD, 10);
        if (cancelled) return;
        setClient(nextClient);
        setMethodSchema(schema);
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult("Error: " + formatError(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const callHello = () => {
    if (!client || !methodSchema) return;
    client
      .callDialog(HELLO_METHOD, ["Plasmon"])
      .then((value) => setResult(formatResult(value)))
      .catch((error: unknown) => setResult("Error: " + formatError(error)));
  };

  return (
    <main className={cx(nt.appFill, "plasmon-app")}>
      <div className="nt-page plasmon-shell">
        <header className="nt-page-header">
          <div>
            <p className="nt-eyebrow">Neutron App Baseline</p>
            <h1 className="nt-title">Plasmon</h1>
            <p className="nt-text">
              Hello-derived baseline used to verify the official Neutron build,
              package, method-schema, and app runtime flow before launcher work.
            </p>
          </div>
          <dl className="nt-kv" data-tid="plasmon-tile-context">
            <dt>App</dt>
            <dd>{tileContext.app ?? "app"}</dd>
            <dt>Tile</dt>
            <dd>{tileContext.tile ?? "tile"}</dd>
          </dl>
        </header>

        <main className="nt-page-main">
          <section className="nt-panel">
            <p className="nt-text">
              This branch intentionally stays close to Neutron's Hello app. The
              version branch replaces this UI with the Plasmon launcher.
            </p>
          </section>
        </main>

        <footer className="nt-page-footer">
          <button
            className="nt-button nt-button--sm"
            data-tid="plasmon-call"
            disabled={!client || !methodSchema}
            onClick={callHello}
            type="button"
          >
            Test typed call
          </button>
          <output className="nt-result" aria-live="polite">
            {result ? <code data-tid="plasmon-result">{result}</code> : "No result yet."}
          </output>
        </footer>
      </div>
    </main>
  );
};

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");
createRoot(container).render(<App />);
