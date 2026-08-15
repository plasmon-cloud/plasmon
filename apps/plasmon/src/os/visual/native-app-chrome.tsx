import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";

function chromeClass(base: string, className?: string): string {
  return className ? `${base} ${className}` : base;
}

/**
 * Shared presentation-only root for application-owned content inside a native
 * window. Window title bars/borders remain Windowing-owned; application state
 * and controls remain with the consuming Native App.
 */
export const NativeAppContentSurface = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  function NativeAppContentSurface({ className, ...props }, ref) {
    return (
      <section
        {...props}
        ref={ref}
        className={chromeClass("plasmon-native-app-surface", className)}
      />
    );
  },
);

export interface NativeAppToolbarProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "nav";
}

/** Shared toolbar framing without prescribing toolbar contents or semantics. */
export function NativeAppToolbar({ as = "div", className, ...props }: NativeAppToolbarProps) {
  const resolvedClassName = chromeClass("plasmon-native-app-toolbar", className);
  if (as === "nav") return <nav {...props} className={resolvedClassName} />;
  return <div {...props} className={resolvedClassName} />;
}

/** Common native-app button presentation; the caller owns action semantics. */
export function NativeAppButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={chromeClass("plasmon-native-app-button", className)} />;
}

/** Shared framed content panel for settings/properties/system-style surfaces. */
export function NativeAppPanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={chromeClass("plasmon-native-app-panel", className)} />;
}

export type NativeAppStateTone = "neutral" | "error";
export interface NativeAppStateSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: NativeAppStateTone;
}

/**
 * Shared loading/empty/error presentation. Accessibility roles and message
 * semantics are intentionally supplied by the owning application.
 */
export function NativeAppStateSurface({ tone = "neutral", className, ...props }: NativeAppStateSurfaceProps) {
  return (
    <div
      {...props}
      className={chromeClass(`plasmon-native-app-state plasmon-native-app-state--${tone}`, className)}
    />
  );
}

/** Shared status-strip framing; status content remains application-defined. */
export function NativeAppStatusStrip({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer {...props} className={chromeClass("plasmon-native-app-status", className)} />;
}
