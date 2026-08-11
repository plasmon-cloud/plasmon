import { useEffect, useRef, useState } from "react";
import { normalizePackageUrl } from "../platform/parse.ts";

export function InstallDialog({
  open,
  busy,
  onClose,
  onInstall,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onInstall: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUrl("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-layer" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="install-title"
        aria-modal="true"
        className="install-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="install-dialog__header">
          <div>
            <p className="eyebrow">Native Neutron install</p>
            <h2 id="install-title">Install an app</h2>
          </div>
          <button
            aria-label="Close install dialog"
            className="icon-button"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <p className="muted-copy">
          Paste an HTTP(S) URL ending in <code>.neutron</code>. Plasmon only
          makes an installation offer; the Kernel keeps its normal owner review
          and final approval flow.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            let normalized: string;
            try {
              normalized = normalizePackageUrl(url);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : String(cause));
              return;
            }
            setError(null);
            // Keep this call in the submit activation task. Vanilla Neutron
            // requires install offers to originate from focused user action.
            onInstall(normalized);
          }}
        >
          <label className="field-label" htmlFor="plasmon-package-url">
            Package URL
          </label>
          <input
            autoComplete="url"
            className="text-input"
            disabled={busy}
            id="plasmon-package-url"
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            placeholder="https://example.com/app.v0.1.0.neutron"
            ref={inputRef}
            spellCheck={false}
            type="url"
            value={url}
          />
          {error ? <p className="field-error" role="alert">{error}</p> : null}

          <div className="dialog-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "Offering…" : "Continue in Neutron"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
