import { AppQr, StoreBadges, TrackLink } from "@/components/Cta";
import type { Dictionary } from "@/lib/content";
import { SITE, type Locale } from "@/lib/constants";
import type { ReactNode } from "react";

export function Footer({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <footer className="border-t border-sand bg-ink text-ivory">
      <div className="mx-auto grid max-w-content gap-12 px-5 py-16 md:grid-cols-2 md:px-8 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <p className="font-display text-3xl">PagneMarket</p>
          <p className="mt-2 text-gold">{t.footer.tagline}</p>
          <p className="mt-6 max-w-sm font-display text-xl leading-snug text-ivory/85">
            {t.footer.manifesto.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>

        <FooterCol title={t.footer.discover}>
          <a href="#vision">{t.nav.vision}</a>
          <a href="#tissus">{t.nav.fabrics}</a>
          <a href="#createurs">{t.nav.creators}</a>
          <a href="#communaute">{t.nav.community}</a>
          <a href="#application">{t.nav.app}</a>
        </FooterCol>

        <FooterCol title={t.footer.professionals}>
          <TrackLink href="#vendeurs" event="vendor_signup_click">
            {t.footer.sell}
          </TrackLink>
          <TrackLink href="#createurs" event="creator_signup_click">
            {t.footer.becomeCreator}
          </TrackLink>
          <TrackLink href="#vendeurs" event="vendor_signup_click">
            {t.footer.becomeSupplier}
          </TrackLink>
        </FooterCol>

        <FooterCol title={t.footer.company}>
          <a href="#entreprise">{t.footer.about}</a>
          <a href={SITE.companyUrl} target="_blank" rel="noreferrer">
            {t.footer.emp}
          </a>
          <TrackLink href={`mailto:${SITE.contactEmail}`} event="contact_click">
            {t.footer.contact}
          </TrackLink>
        </FooterCol>

        <FooterCol title={t.footer.support}>
          <a href="#faq">{t.footer.faq}</a>
          <a href={`/${locale}/privacy`}>{t.footer.privacy}</a>
          <a href="#conditions">{t.footer.terms}</a>
          <TrackLink href={`mailto:${SITE.contactEmail}`} event="contact_click">
            {t.footer.contact}
          </TrackLink>
        </FooterCol>
      </div>

      <div className="mx-auto flex max-w-content flex-col gap-8 border-t border-white/10 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-ivory/50">Social</p>
          <div className="flex flex-wrap gap-4 text-sm text-ivory/80">
            <a href={SITE.social.instagram}>Instagram</a>
            <a href={SITE.social.facebook}>Facebook</a>
            <a href={SITE.social.tiktok}>TikTok</a>
            <a href={SITE.social.youtube}>YouTube</a>
            <a href={SITE.social.whatsapp}>WhatsApp</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AppQr className="scale-75 origin-bottom-left" />
          <StoreBadges />
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-6 text-center text-xs text-ivory/45 md:px-8">
        {t.footer.rights}
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-gold">{title}</p>
      <div className="mt-4 flex flex-col gap-2 text-sm text-ivory/75 [&_a]:transition hover:[&_a]:text-ivory">
        {children}
      </div>
    </div>
  );
}
