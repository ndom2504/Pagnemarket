"use client";

import { track, type TrackEvent } from "@/lib/analytics";
import { SITE } from "@/lib/constants";
import type { ReactNode } from "react";

type Props = {
  href?: string;
  event?: TrackEvent;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

export function TrackLink({ href = SITE.appUrl, event, className, children, onClick }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        if (event) track(event);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <TrackLink
        href={SITE.appStoreUrl}
        event="app_store_click"
        className="inline-flex h-12 items-center gap-3 rounded-xl bg-ink px-4 text-ivory transition hover:bg-ink/90"
      >
        <AppleIcon />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-wide opacity-70">Download on the</span>
          <span className="block text-sm font-semibold">App Store</span>
        </span>
      </TrackLink>
      <TrackLink
        href={SITE.playStoreUrl}
        event="google_play_click"
        className="inline-flex h-12 items-center gap-3 rounded-xl bg-ink px-4 text-ivory transition hover:bg-ink/90"
      >
        <PlayIcon />
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-wide opacity-70">Get it on</span>
          <span className="block text-sm font-semibold">Google Play</span>
        </span>
      </TrackLink>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.18 3.03-.8.88-2.12 1.56-3.24 1.47-.14-1.1.4-2.26 1.16-3.1.8-.9 2.2-1.56 3.26-1.4zM20.5 17.2c-.58 1.32-.86 1.9-1.6 3.06-1.04 1.54-2.5 3.46-4.32 3.48-1.62.02-2.04-1.06-4.24-1.05-2.2.01-2.66 1.07-4.28 1.05-1.82-.02-3.22-1.76-4.26-3.3C.3 17.3-.7 13.4.9 10.66c1.02-1.74 2.64-2.84 4.48-2.84 1.68 0 2.74 1.08 4.14 1.08 1.36 0 2.2-1.1 4.16-1.1 1.48 0 3.04.8 4.14 2.18-3.64 2-3.04 7.2 2.68 7.22z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.6 2.3c-.4.2-.6.6-.6 1v17.4c0 .4.2.8.6 1l10.4-9.7L3.6 2.3zm12.1 6.8L5.5 3.1l11.5 6.6-1.3-.6zm.8 1.5 2.6 1.5c.7.4.7 1.4 0 1.8l-2.6 1.5-2.2-2.1 2.2-2.7zm-1.1 3.4L5.5 20.9l10.2-5.9 1.3-.6z" />
    </svg>
  );
}

/** Minimal QR pointing to /app — SVG matrix for https://pagnemarket.com/app */
export function AppQr({ className = "" }: { className?: string }) {
  return (
    <a
      href={SITE.appUrl}
      onClick={() => track("app_download_click")}
      className={`block rounded-2xl bg-ivory p-3 shadow-sm ring-1 ring-sand ${className}`}
      aria-label="QR code — download PagneMarket"
    >
      <svg viewBox="0 0 41 41" className="h-28 w-28" role="img">
        <rect width="41" height="41" fill="#F8F5EF" />
        {/* Simplified brand QR-like mark (not a scannable matrix placeholder visual) */}
        <rect x="3" y="3" width="11" height="11" fill="#111" />
        <rect x="5" y="5" width="7" height="7" fill="#F8F5EF" />
        <rect x="7" y="7" width="3" height="3" fill="#111" />
        <rect x="27" y="3" width="11" height="11" fill="#111" />
        <rect x="29" y="5" width="7" height="7" fill="#F8F5EF" />
        <rect x="31" y="7" width="3" height="3" fill="#111" />
        <rect x="3" y="27" width="11" height="11" fill="#111" />
        <rect x="5" y="29" width="7" height="7" fill="#F8F5EF" />
        <rect x="7" y="31" width="3" height="3" fill="#111" />
        <rect x="18" y="3" width="2" height="2" fill="#111" />
        <rect x="22" y="5" width="2" height="2" fill="#111" />
        <rect x="18" y="8" width="2" height="2" fill="#111" />
        <rect x="20" y="12" width="2" height="2" fill="#111" />
        <rect x="16" y="16" width="9" height="9" fill="#111" />
        <rect x="18" y="18" width="5" height="5" fill="#C8A96B" />
        <rect x="27" y="18" width="2" height="2" fill="#111" />
        <rect x="31" y="20" width="2" height="2" fill="#111" />
        <rect x="35" y="16" width="2" height="2" fill="#111" />
        <rect x="18" y="27" width="2" height="2" fill="#111" />
        <rect x="22" y="31" width="2" height="2" fill="#111" />
        <rect x="27" y="27" width="2" height="2" fill="#111" />
        <rect x="31" y="31" width="5" height="5" fill="#111" />
        <rect x="35" y="35" width="2" height="2" fill="#111" />
      </svg>
    </a>
  );
}
