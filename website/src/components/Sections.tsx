import { AppQr, StoreBadges, TrackLink } from "@/components/Cta";
import { Reveal } from "@/components/Reveal";
import type { Dictionary } from "@/lib/content";
import { SITE } from "@/lib/constants";

const EDITORIAL =
  "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=80";
const CREATORS_IMG =
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1400&q=80";

export function Sections({ t }: { t: Dictionary }) {
  return (
    <>
      <section id="vision" className="textile-grain px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <p className="font-display text-3xl leading-tight text-ink md:text-5xl lg:text-6xl">
              {t.manifesto.lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-10 max-w-3xl text-lg leading-relaxed text-ink/75 md:text-xl">
              {t.manifesto.editorial}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-clay">
              Connecter l&apos;Afrique. Rassembler le monde.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-ink px-5 py-24 text-ivory md:px-8 md:py-32">
        <div className="mx-auto grid max-w-content items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="whitespace-pre-line font-display text-3xl leading-tight md:text-5xl">
              {t.moreThanFabric.title}
            </h2>
            <p className="mt-8 text-base leading-relaxed text-ivory/75 md:text-lg">
              {t.moreThanFabric.body}
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative overflow-hidden">
              <img
                src={EDITORIAL}
                alt=""
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pattern-subtle bg-ivory px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.22em] text-clay">{t.afro.kicker}</p>
            <h2 className="mt-4 font-display text-3xl md:text-5xl">{t.afro.title}</h2>
            <p className="mt-6 max-w-3xl text-lg text-ink/70">{t.afro.definition}</p>
            <p className="mt-4 max-w-3xl text-base text-ink/80">{t.afro.body}</p>
          </Reveal>
          <div className="mt-10 flex flex-wrap gap-3">
            {t.afro.tags.map((tag, i) => (
              <Reveal key={tag} delay={i * 40}>
                <span className="rounded-full border border-ink/15 bg-white/60 px-4 py-2 text-sm text-ink">
                  {tag}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="impact" className="bg-sand/40 px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl">{t.impact.title}</h2>
            <p className="mt-3 max-w-2xl text-ink/65">{t.impact.subtitle}</p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {t.impact.pillars.map((p, i) => (
              <Reveal key={p.n} delay={i * 70}>
                <article className="h-full border-t border-ink pt-6">
                  <p className="font-display text-gold">{p.n}</p>
                  <h3 className="mt-3 font-display text-2xl">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">{p.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Ecosystem t={t} />
      <WorldBridge t={t} />

      <section id="tissus" className="bg-ivory px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="max-w-3xl font-display text-3xl md:text-5xl">{t.marketplace.title}</h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {t.marketplace.categories.map((c, i) => (
              <Reveal key={c} delay={i * 30}>
                <div className="group relative overflow-hidden bg-ink px-4 py-8 text-center text-ivory transition hover:bg-forest">
                  <span className="absolute inset-0 opacity-0 transition group-hover:opacity-100 pattern-subtle" />
                  <span className="relative font-display text-xl">{c}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={100}>
            <TrackLink
              href={SITE.appUrl}
              event="app_download_click"
              className="mt-10 inline-flex rounded-full bg-ink px-6 py-3.5 text-sm text-ivory"
            >
              {t.marketplace.cta}
            </TrackLink>
          </Reveal>
        </div>
      </section>

      <section id="createurs" className="bg-ink px-5 py-24 text-ivory md:px-8 md:py-32">
        <div className="mx-auto grid max-w-content gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <img src={CREATORS_IMG} alt="" className="aspect-[5/6] w-full object-cover" />
          </Reveal>
          <Reveal delay={100}>
            <h2 className="font-display text-3xl md:text-5xl">{t.creators.title}</h2>
            <p className="mt-6 text-base leading-relaxed text-ivory/75 md:text-lg">{t.creators.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <TrackLink
                href={SITE.appUrl}
                event="creator_signup_click"
                className="rounded-full bg-ivory px-6 py-3.5 text-sm text-ink"
              >
                {t.creators.cta}
              </TrackLink>
              <TrackLink
                href={SITE.appUrl}
                event="creator_signup_click"
                className="rounded-full border border-ivory/35 px-6 py-3.5 text-sm text-ivory"
              >
                {t.creators.ctaSecondary}
              </TrackLink>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="vendeurs" className="textile-grain px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl">{t.vendors.title}</h2>
            <p className="mt-6 text-lg text-ink/70">{t.vendors.body}</p>
            <TrackLink
              href={SITE.appUrl}
              event="vendor_signup_click"
              className="mt-8 inline-flex rounded-full bg-clay px-6 py-3.5 text-sm text-ivory"
            >
              {t.vendors.cta}
            </TrackLink>
          </Reveal>
        </div>
      </section>

      <section id="communaute" className="bg-forest px-5 py-24 text-ivory md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="whitespace-pre-line font-display text-3xl md:text-5xl">{t.community.title}</h2>
            <p className="mt-6 max-w-2xl text-lg text-ivory/75">{t.community.body}</p>
          </Reveal>
          <div className="mt-12 flex flex-wrap gap-3">
            {t.community.items.map((item, i) => (
              <Reveal key={item} delay={i * 35}>
                <span className="border border-ivory/25 px-4 py-2 text-sm">{item}</span>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <TrackLink
              href={SITE.appUrl}
              event="join_community_click"
              className="mt-10 inline-flex rounded-full bg-ivory px-6 py-3.5 text-sm text-ink"
            >
              {t.community.cta}
            </TrackLink>
          </Reveal>
        </div>
      </section>

      <section id="application" className="bg-ivory px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="max-w-3xl font-display text-3xl md:text-5xl">{t.app.title}</h2>
            <p className="mt-4 max-w-2xl text-lg text-ink/70">{t.app.body}</p>
          </Reveal>
          <div className="mt-14 flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-6 md:overflow-visible">
            {t.app.screens.map((screen, i) => (
              <Reveal key={screen} delay={i * 50} className="min-w-[140px] flex-1">
                <div className="animate-float rounded-[1.6rem] border border-ink/10 bg-ink p-2 shadow-xl" style={{ animationDelay: `${i * 0.4}s` }}>
                  <div className="aspect-[9/19] rounded-[1.25rem] bg-gradient-to-b from-sand/30 to-ink p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-gold">{screen}</p>
                    <div className="mt-6 space-y-2">
                      <div className="h-16 rounded-lg bg-ivory/10" />
                      <div className="h-3 w-2/3 rounded bg-ivory/15" />
                      <div className="h-3 w-1/2 rounded bg-ivory/10" />
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={100}>
            <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
              <div>
                <TrackLink
                  event="app_download_click"
                  className="inline-flex rounded-full bg-ink px-6 py-3.5 text-sm text-ivory"
                >
                  {t.app.cta}
                </TrackLink>
                <div className="mt-5">
                  <StoreBadges />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-ink/50">{t.app.qrLabel}</p>
                <AppQr />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="ia" className="bg-sand/50 px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl">{t.ai.title}</h2>
            <p className="mt-6 max-w-3xl text-lg text-ink/70">{t.ai.body}</p>
          </Reveal>
          <div className="mt-12 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            {t.ai.steps.map((step, i) => (
              <Reveal key={step} delay={i * 80} className="flex flex-1 items-center gap-3">
                <div className="flex-1 border border-ink/15 bg-ivory px-5 py-6 text-center">
                  <p className="text-xs text-gold">{String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-2 font-display text-xl">{step}</p>
                </div>
                {i < t.ai.steps.length - 1 && (
                  <span className="hidden text-gold md:inline" aria-hidden>
                    →
                  </span>
                )}
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <TrackLink
              href={SITE.appUrl}
              event="app_download_click"
              className="mt-10 inline-flex rounded-full bg-ink px-6 py-3.5 text-sm text-ivory"
            >
              {t.ai.cta}
            </TrackLink>
          </Reveal>
        </div>
      </section>

      <section className="bg-ivory px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl">{t.how.title}</h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {t.how.steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 70}>
                <p className="font-display text-gold">{s.n}</p>
                <h3 className="mt-3 font-display text-2xl">{s.title}</h3>
                <p className="mt-3 text-sm text-ink/70">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-24 text-ivory md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl">{t.philosophy.title}</h2>
            <div className="mt-10 space-y-4 font-display text-2xl leading-snug text-ivory/90 md:text-3xl">
              {t.philosophy.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <p className="mt-8 text-sm uppercase tracking-[0.18em] text-gold">{t.philosophy.note}</p>
          </Reveal>
        </div>
      </section>

      <section id="entreprise" className="textile-grain px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-content">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl">{t.techImpact.title}</h2>
            <p className="mt-6 max-w-3xl text-lg text-ink/75">{t.techImpact.body}</p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {t.techImpact.believes.map((b) => (
                <li key={b} className="border-l-2 border-gold pl-4 text-ink/80">
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-16 max-w-3xl border border-ink/10 bg-white/50 p-8 md:p-10">
              <h3 className="font-display text-2xl md:text-3xl">{t.company.title}</h3>
              <p className="mt-4 text-ink/70">{t.company.body}</p>
              <a
                href={SITE.companyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex text-sm font-medium text-clay underline-offset-4 hover:underline"
              >
                {t.company.cta}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink px-5 py-28 text-center text-ivory md:px-8 md:py-36">
        <div className="pointer-events-none absolute inset-0 opacity-30 pattern-subtle" />
        <div className="relative mx-auto max-w-3xl">
          <Reveal>
            <h2 className="font-display text-3xl md:text-5xl lg:text-6xl">{t.final.title}</h2>
            <p className="mt-6 text-lg text-ivory/75">{t.final.subtitle}</p>
            <TrackLink
              event="app_download_click"
              className="mt-10 inline-flex rounded-full bg-ivory px-7 py-4 text-sm font-medium text-ink"
            >
              {t.final.cta}
            </TrackLink>
            <div className="mt-8 flex flex-col items-center gap-6">
              <StoreBadges />
              <AppQr />
            </div>
            <p className="mt-16 font-display text-4xl">{t.final.brand}</p>
            <p className="mt-2 text-gold">{t.final.tagline}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function Ecosystem({ t }: { t: Dictionary }) {
  return (
    <section className="bg-ivory px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-content">
        <Reveal>
          <h2 className="font-display text-3xl md:text-5xl">{t.ecosystem.title}</h2>
          <p className="mt-3 text-ink/65">{t.ecosystem.subtitle}</p>
        </Reveal>
        <Reveal delay={100}>
          <div className="relative mx-auto mt-16 aspect-square max-w-xl">
            <div className="absolute inset-[18%] rounded-full border border-gold/40 animate-pulseLine" />
            <div className="absolute inset-[30%] rounded-full border border-ink/10" />
            <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-center text-xs font-medium tracking-[0.12em] text-ivory shadow-2xl md:h-36 md:w-36 md:text-sm">
              {t.ecosystem.center}
            </div>
            {t.ecosystem.nodes.map((node, i) => {
              const angle = (i / t.ecosystem.nodes.length) * Math.PI * 2 - Math.PI / 2;
              const x = 50 + Math.cos(angle) * 42;
              const y = 50 + Math.sin(angle) * 42;
              return (
                <div
                  key={node}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-sand bg-white px-3 py-2 text-xs shadow-sm md:text-sm"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {node}
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function WorldBridge({ t }: { t: Dictionary }) {
  return (
    <section id="monde" className="bg-ink px-5 py-24 text-ivory md:px-8 md:py-32">
      <div className="mx-auto max-w-content">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">{t.world.subtitle}</p>
          <h2 className="mt-3 font-display text-3xl md:text-5xl">{t.world.title}</h2>
          <p className="mt-6 max-w-3xl text-lg text-ivory/75">{t.world.body}</p>
        </Reveal>

        <Reveal delay={120}>
          <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-6 md:p-10">
            <svg viewBox="0 0 800 360" className="h-auto w-full" aria-hidden>
              <defs>
                <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#C8A96B" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#C8A96B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#A95538" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <path
                d="M120 220 C 260 40, 540 40, 680 200"
                fill="none"
                stroke="url(#arc)"
                strokeWidth="1.5"
                className="animate-pulseLine"
              />
              <path
                d="M150 240 C 300 90, 500 90, 650 220"
                fill="none"
                stroke="#E5D7C3"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              <circle cx="160" cy="230" r="6" fill="#C8A96B" />
              <circle cx="400" cy="90" r="5" fill="#F8F5EF" />
              <circle cx="660" cy="210" r="6" fill="#A95538" />
              <text x="140" y="265" fill="#F8F5EF" fontSize="14" opacity="0.85">
                Afrique
              </text>
              <text x="370" y="75" fill="#C8A96B" fontSize="14">
                Diaspora
              </text>
              <text x="640" y="245" fill="#F8F5EF" fontSize="14" opacity="0.85">
                Monde
              </text>
            </svg>
            <div className="mt-6 flex flex-wrap gap-2">
              {t.world.regions.map((r) => (
                <span key={r} className="rounded-full border border-white/15 px-3 py-1 text-xs text-ivory/75">
                  {r}
                </span>
              ))}
            </div>
            <p className="mt-6 text-xs text-ivory/45">{t.world.note}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
