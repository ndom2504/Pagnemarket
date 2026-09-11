"use client";

import { TrackLink } from "@/components/Cta";
import type { Dictionary } from "@/lib/content";
import type { Locale } from "@/lib/constants";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Header({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const other: Locale = locale === "fr" ? "en" : "fr";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#vision", label: t.nav.vision },
    { href: "#tissus", label: t.nav.fabrics },
    { href: "#createurs", label: t.nav.creators },
    { href: "#communaute", label: t.nav.community },
    { href: "#application", label: t.nav.app },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition ${
        scrolled ? "bg-ivory/90 shadow-sm backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-content items-center justify-between px-5 py-4 md:px-8">
        <a href="#top" className="font-display text-xl tracking-tight text-ink md:text-2xl">
          Pagne<span className="text-clay">Market</span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-ink/75 transition hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={`/${other}/`}
            className="text-xs font-medium uppercase tracking-[0.14em] text-ink/70 hover:text-ink"
          >
            {other.toUpperCase()}
          </Link>
          <TrackLink
            event="app_download_click"
            className="hidden rounded-full bg-ink px-4 py-2 text-sm text-ivory transition hover:bg-ink/90 sm:inline-flex"
          >
            {t.nav.download}
          </TrackLink>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 lg:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <div className="space-y-1.5">
              <span className="block h-px w-5 bg-ink" />
              <span className="block h-px w-5 bg-ink" />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-sand bg-ivory px-5 py-6 lg:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-base text-ink"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <TrackLink
              event="app_download_click"
              className="mt-2 inline-flex justify-center rounded-full bg-ink px-4 py-3 text-sm text-ivory"
            >
              {t.nav.download}
            </TrackLink>
          </div>
        </div>
      )}
    </header>
  );
}
