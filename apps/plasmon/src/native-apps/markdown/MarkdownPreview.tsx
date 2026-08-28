import { useMemo, type CSSProperties, type MouseEvent } from "react";
import { isSafeMarkdownHref, renderSafeMarkdown } from "./render.ts";

export interface MarkdownPreviewProps {
  source: string;
  visible?: boolean;
}

export function MarkdownPreview({ source, visible = true }: MarkdownPreviewProps) {
  const safeHtml = useMemo(() => renderSafeMarkdown(source), [source]);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute("href") ?? "";
    if (!isSafeMarkdownHref(href)) return;
    if (/^https?:/iu.test(href) && typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    } else if (/^mailto:/iu.test(href) && typeof window !== "undefined") {
      window.location.href = href;
    }
  };

  return (
    <div style={{ ...styles.root, display: visible ? "block" : "none" }}>
      <style>{MARKDOWN_PREVIEW_CSS}</style>
      <article
        className="plasmon-markdown-preview"
        aria-label="Markdown preview"
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    background: "var(--plasmon-window-background, Canvas)",
    color: "var(--plasmon-text-primary, CanvasText)",
  },
};

export const MARKDOWN_PREVIEW_CSS = `
.plasmon-markdown-preview {
  box-sizing: border-box;
  min-height: 100%;
  margin: 0;
  padding: 20px 26px 36px;
  color: var(--plasmon-text-primary, CanvasText);
  background: var(--plasmon-window-background, Canvas);
  font: 15px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-wrap: anywhere;
}
.plasmon-markdown-preview > :first-child { margin-top: 0; }
.plasmon-markdown-preview > :last-child { margin-bottom: 0; }
.plasmon-markdown-preview h1,
.plasmon-markdown-preview h2,
.plasmon-markdown-preview h3 {
  margin: 1.35em 0 0.6em;
  font-weight: 700;
  line-height: 1.25;
}
.plasmon-markdown-preview h1,
.plasmon-markdown-preview h2 {
  border-bottom: 1px solid var(--plasmon-border-subtle, ButtonBorder);
  padding-bottom: 0.3em;
}
.plasmon-markdown-preview h1 { font-size: 2em; }
.plasmon-markdown-preview h2 { font-size: 1.5em; }
.plasmon-markdown-preview h3 { font-size: 1.25em; }
.plasmon-markdown-preview p { margin: 0 0 1em; }
.plasmon-markdown-preview ul,
.plasmon-markdown-preview ol {
  margin: 0 0 1em;
  padding-left: 2em;
}
.plasmon-markdown-preview ul { list-style: disc outside; }
.plasmon-markdown-preview ol { list-style: decimal outside; }
.plasmon-markdown-preview li { display: list-item; }
.plasmon-markdown-preview li + li { margin-top: 0.2em; }
.plasmon-markdown-preview a { color: var(--plasmon-accent, LinkText); text-decoration: none; }
.plasmon-markdown-preview a:hover { color: var(--plasmon-accent-hover, LinkText); text-decoration: underline; }
.plasmon-markdown-preview blockquote {
  margin-left: 0;
  padding: 0.15em 1em;
  border-left: 4px solid var(--plasmon-border-strong, ButtonBorder);
  color: var(--plasmon-text-secondary, CanvasText);
}
.plasmon-markdown-preview pre {
  overflow: auto;
  padding: 14px 16px;
  border: 1px solid var(--plasmon-border-subtle, ButtonBorder);
  border-radius: 6px;
  background: var(--plasmon-panel-elevated, Canvas);
  color: var(--plasmon-text-primary, CanvasText);
  font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.plasmon-markdown-preview code:not(pre code) {
  padding: 0.16em 0.35em;
  border-radius: 4px;
  background: var(--plasmon-control-background, Canvas);
  color: var(--plasmon-text-primary, CanvasText);
  box-shadow: inset 0 0 0 1px var(--plasmon-border-subtle, ButtonBorder);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.plasmon-markdown-preview table { border-collapse: collapse; display: block; overflow-x: auto; }
.plasmon-markdown-preview th,
.plasmon-markdown-preview td { border: 1px solid var(--plasmon-border-subtle, ButtonBorder); padding: 6px 10px; }
.plasmon-markdown-preview th { background: var(--plasmon-panel-elevated, Canvas); }
.plasmon-markdown-preview tr:nth-child(even) { background: var(--plasmon-control-background, Canvas); }
.plasmon-markdown-preview hr { border: 0; border-top: 1px solid var(--plasmon-border-subtle, ButtonBorder); }
.plasmon-markdown-preview img { max-width: 100%; }
`;
