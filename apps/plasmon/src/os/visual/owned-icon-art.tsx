import type { FileTypeIconName, SystemIconName } from "./assets.ts";

interface OwnedSvgProps {
  className?: string | undefined;
  children: React.ReactNode;
  name: string;
}

const slot = {
  primary: "var(--plasmon-icon-primary)",
  secondary: "var(--plasmon-icon-secondary)",
  accent: "var(--plasmon-icon-accent)",
  outline: "var(--plasmon-icon-outline)",
  highlight: "var(--plasmon-icon-highlight)",
} as const;

function OwnedSvg({ className, children, name }: OwnedSvgProps) {
  return <svg
    className={`plasmon-icon-art plasmon-owned-icon${className ? ` ${className}` : ""}`}
    data-plasmon-owned-icon={name}
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
  >{children}</svg>;
}

function SystemFrame({ children }: { children: React.ReactNode }) {
  return <>
    <rect x="5" y="5" width="54" height="54" rx="13" fill={slot.primary} stroke={slot.outline} strokeWidth="2" />
    {children}
  </>;
}

export function OwnedSystemIcon({ icon, className }: { icon: SystemIconName; className?: string | undefined }) {
  let glyph: React.ReactNode;
  switch (icon) {
    case "application":
      glyph = <>
        <rect x="15" y="16" width="34" height="32" rx="4" fill="none" stroke={slot.accent} strokeWidth="2.5" />
        <path d="M15 25h34M25 25v23" fill="none" stroke={slot.secondary} strokeWidth="2.5" />
      </>;
      break;
    case "file-manager":
      glyph = <>
        <path d="M13 25h16l5 5h17v18H13z" fill={slot.secondary} stroke={slot.accent} strokeWidth="2" />
        <path d="M14 19h14l4 5H14z" fill={slot.accent} opacity=".82" />
        <path d="M37 34v10" stroke={slot.highlight} strokeWidth="2" />
      </>;
      break;
    case "settings":
      glyph = <>
        <path d="M32 15l4 2 4-1 3 3-1 4 2 4 4 2v6l-4 2-2 4 1 4-3 3-4-1-4 2-4-2-4 1-3-3 1-4-2-4-4-2v-6l4-2 2-4-1-4 3-3 4 1z" fill={slot.secondary} stroke={slot.accent} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="6" fill={slot.primary} stroke={slot.highlight} strokeWidth="2.5" />
      </>;
      break;
    case "start":
      glyph = <g transform="rotate(45 32 32)">
        <rect x="17" y="17" width="30" height="30" fill="none" stroke={slot.accent} strokeWidth="2.4" />
        <rect x="27" y="10" width="10" height="44" fill="none" stroke={slot.secondary} strokeWidth="2.2" opacity=".78" />
        <rect x="10" y="27" width="44" height="10" fill="none" stroke={slot.secondary} strokeWidth="2.2" opacity=".78" />
        <rect x="29" y="29" width="6" height="6" fill={slot.highlight} />
      </g>;
      break;
    case "search":
      glyph = <>
        <circle cx="28" cy="28" r="12" fill={slot.secondary} opacity=".35" stroke={slot.accent} strokeWidth="2.5" />
        <path d="M37 37l11 11" stroke={slot.highlight} strokeWidth="4" strokeLinecap="round" />
      </>;
      break;
    case "photos":
      glyph = <>
        <rect x="14" y="15" width="36" height="34" rx="5" fill={slot.secondary} opacity=".34" stroke={slot.accent} strokeWidth="2.2" />
        <circle cx="38" cy="25" r="4" fill={slot.highlight} />
        <path d="M18 44l10-11 7 7 5-5 7 9z" fill={slot.accent} stroke={slot.outline} strokeWidth="1.5" strokeLinejoin="round" />
      </>;
      break;
    case "browser":
      glyph = <>
        <circle cx="32" cy="32" r="17" fill={slot.secondary} opacity=".24" stroke={slot.accent} strokeWidth="2.4" />
        <path d="M15 32h34M32 15c6 6 8 11 8 17s-2 11-8 17M32 15c-6 6-8 11-8 17s2 11 8 17" fill="none" stroke={slot.highlight} strokeWidth="1.8" />
      </>;
      break;
    case "recycle-bin":
      glyph = <>
        <path d="M21 22h22l-2 27H23z" fill={slot.secondary} opacity=".42" stroke={slot.accent} strokeWidth="2" strokeLinejoin="round" />
        <path d="M18 19h28M27 15h10M28 28v14M36 28v14" stroke={slot.highlight} strokeWidth="2.2" strokeLinecap="round" />
      </>;
      break;
    case "properties":
      glyph = <>
        <path d="M18 21h28M18 32h28M18 43h28" stroke={slot.secondary} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="27" cy="21" r="4" fill={slot.accent} stroke={slot.highlight} strokeWidth="1.6" />
        <circle cx="39" cy="32" r="4" fill={slot.accent} stroke={slot.highlight} strokeWidth="1.6" />
        <circle cx="30" cy="43" r="4" fill={slot.accent} stroke={slot.highlight} strokeWidth="1.6" />
      </>;
      break;
    case "terminal":
      glyph = <>
        <rect x="12" y="15" width="40" height="34" rx="5" fill={slot.secondary} opacity=".42" stroke={slot.accent} strokeWidth="2" />
        <path d="m19 25 8 7-8 7" fill="none" stroke={slot.highlight} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 40h13" stroke={slot.highlight} strokeWidth="4" strokeLinecap="round" />
      </>;
      break;
    case "pin":
      glyph = <>
        <path d="M25 17h14l-2 8 6 7v3H34v12l-2 4-2-4V35h-9v-3l6-7z" fill={slot.accent} stroke={slot.highlight} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M25 32h14" stroke={slot.secondary} strokeWidth="2" />
      </>;
      break;
  }

  return <OwnedSvg name={`system:${icon}`} className={className}><SystemFrame>{glyph}</SystemFrame></OwnedSvg>;
}

function FileSheet({ children }: { children?: React.ReactNode }) {
  return <>
    <path d="M16 7h22l12 12v38H16z" fill={slot.primary} stroke={slot.outline} strokeWidth="2" strokeLinejoin="round" />
    <path d="M38 7v13h12" fill={slot.secondary} opacity=".55" stroke={slot.accent} strokeWidth="2" />
    {children}
  </>;
}

function MediaPlay() {
  return <path d="M27 28l12 7-12 7z" fill={slot.highlight} stroke={slot.accent} strokeWidth="1.4" strokeLinejoin="round" />;
}

export function OwnedFileTypeIcon({ icon, className }: { icon: FileTypeIconName; className?: string | undefined }) {
  if (icon === "folder") {
    return <OwnedSvg name="file-type:folder" className={className}>
      <path d="M7 18.5A5.5 5.5 0 0 1 12.5 13H27l6 6h18.5a5.5 5.5 0 0 1 5.5 5.5v25A5.5 5.5 0 0 1 51.5 55h-39A5.5 5.5 0 0 1 7 49.5z" fill={slot.primary} stroke={slot.outline} strokeWidth="2" />
      <path d="M8 26h48" stroke={slot.secondary} strokeWidth="2.5" />
      <path d="M13 19h15l4 4H13z" fill={slot.accent} opacity=".72" />
    </OwnedSvg>;
  }

  let content: React.ReactNode = null;
  switch (icon) {
    case "file":
      content = <path d="M23 34h20M23 42h16" stroke={slot.secondary} strokeWidth="2.5" strokeLinecap="round" />;
      break;
    case "text":
      content = <path d="M23 30h18M23 36h18M23 42h14" stroke={slot.accent} strokeWidth="2.6" strokeLinecap="round" />;
      break;
    case "markdown":
      content = <path d="M22 42V29l6 7 6-7v13M38 30v12m0 0-4-4m4 4 4-4" fill="none" stroke={slot.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />;
      break;
    case "image":
      content = <>
        <circle cx="37" cy="29" r="3" fill={slot.highlight} />
        <path d="M21 44l8-9 5 5 4-4 6 8z" fill={slot.accent} stroke={slot.secondary} strokeWidth="1.5" strokeLinejoin="round" />
      </>;
      break;
    case "video":
      content = <MediaPlay />;
      break;
    case "audio":
      content = <>
        <path d="M36 26v16a5 5 0 1 1-3-4.6V29l10-2v12a5 5 0 1 1-3-4.6V24z" fill={slot.accent} stroke={slot.highlight} strokeWidth="1.5" strokeLinejoin="round" />
      </>;
      break;
    case "atom":
      content = <>
        <ellipse cx="33" cy="36" rx="13" ry="5" fill="none" stroke={slot.secondary} strokeWidth="1.8" />
        <ellipse cx="33" cy="36" rx="13" ry="5" transform="rotate(60 33 36)" fill="none" stroke={slot.accent} strokeWidth="1.8" />
        <ellipse cx="33" cy="36" rx="13" ry="5" transform="rotate(120 33 36)" fill="none" stroke={slot.highlight} strokeWidth="1.8" />
        <circle cx="33" cy="36" r="2.5" fill={slot.accent} />
      </>;
      break;
    case "jsdos":
      content = <>
        <path d="M23 31l6 5-6 5M32 42h10" fill="none" stroke={slot.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="20" y="26" width="25" height="20" rx="2" fill="none" stroke={slot.secondary} strokeWidth="1.7" />
      </>;
      break;
    case "rom-game":
      content = <>
        <path d="M22 34c2-5 5-7 11-7s9 2 12 7l2 8c1 4-3 6-6 3l-4-4h-8l-4 4c-3 3-7 1-6-3z" fill={slot.secondary} opacity=".65" stroke={slot.accent} strokeWidth="1.8" />
        <path d="M25 34v7M21.5 37.5h7M39 35h.1M43 39h.1" stroke={slot.highlight} strokeWidth="2.5" strokeLinecap="round" />
      </>;
      break;
    case "game-save":
      content = <>
        <path d="M22 27h22v19H22z" fill={slot.secondary} opacity=".5" stroke={slot.accent} strokeWidth="1.8" />
        <path d="M27 27v7h11v-7M27 41h12" fill="none" stroke={slot.highlight} strokeWidth="2" />
      </>;
      break;
    case "emulator-save-state":
      content = <>
        <rect x="22" y="27" width="20" height="16" rx="2" fill={slot.secondary} opacity=".36" stroke={slot.accent} strokeWidth="1.8" />
        <path d="M26 23h20v16M18 31v16h20" fill="none" stroke={slot.highlight} strokeWidth="1.8" strokeLinejoin="round" />
      </>;
      break;
    case "dos-changes":
      content = <>
        <path d="M22 29l5 4-5 4M31 38h9" fill="none" stroke={slot.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 28v7M36.5 31.5h7" stroke={slot.highlight} strokeWidth="2" strokeLinecap="round" />
      </>;
      break;
    case "folder":
      break;
  }

  return <OwnedSvg name={`file-type:${icon}`} className={className}><FileSheet>{content}</FileSheet></OwnedSvg>;
}

export function OwnedShortcutOverlay({ className }: { className?: string | undefined }) {
  return <svg
    className={`plasmon-owned-icon plasmon-owned-shortcut-overlay${className ? ` ${className}` : ""}`}
    data-plasmon-owned-icon="shortcut-overlay"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="1" y="1" width="18" height="18" rx="5" fill={slot.primary} stroke={slot.outline} strokeWidth="1.5" />
    <path d="M5 13L13 5M8 5h5v5" fill="none" stroke={slot.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}