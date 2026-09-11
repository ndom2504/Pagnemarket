import { AppQr, StoreBadges, TrackLink } from "@/components/Cta";
import type { Dictionary } from "@/lib/content";

const HERO_IMG =
  "https://images.unsplash.com/photo-1594737625785-c668baea5dee?auto=format&fit=crop&w=2200&q=80";

export function Hero({ t }: { t: Dictionary }) {
  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden bg-ink text-ivory">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-content flex-col justify-end px-5 pb-28 pt-32 md:px-8 md:pb-20">
        <p className="animate-fade-in font-display text-4xl tracking-tight text-ivory md:text-6xl lg:text-7xl">
          {t.hero.brand}
        </p>
        <h1 className="mt-4 max-w-3xl animate-fade-up font-display text-3xl leading-[1.05] text-balance text-ivory md:text-5xl lg:text-6xl">
          {t.hero.title}
        </h1>
        <p className="mt-5 max-w-xl animate-fade-up text-base leading-relaxed text-ivory/80 md:text-lg" style={{ animationDelay: "120ms" }}>
          {t.hero.subtitle}
        </p>
        <div className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "220ms" }}>
          <a
            href="#vision"
            className="inline-flex items-center justify-center rounded-full bg-ivory px-6 py-3.5 text-sm font-medium text-ink transition hover:bg-sand"
          >
            {t.hero.ctaPrimary}
          </a>
          <TrackLink
            event="app_download_click"
            className="inline-flex items-center justify-center rounded-full border border-ivory/40 px-6 py-3.5 text-sm font-medium text-ivory transition hover:border-ivory hover:bg-ivory/10"
          >
            {t.hero.ctaSecondary}
          </TrackLink>
        </div>
        <div className="mt-10 animate-fade-up" style={{ animationDelay: "320ms" }}>
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-ivory/55">{t.hero.available}</p>
          <div className="flex flex-wrap items-end gap-5">
            <StoreBadges />
            <AppQr className="hidden sm:block" />
          </div>
        </div>
      </div>
    </section>
  );
}
