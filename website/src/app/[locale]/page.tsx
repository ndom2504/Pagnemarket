import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Sections } from "@/components/Sections";
import { StickyDownload } from "@/components/StickyDownload";
import { SITE, type Locale, isLocale } from "@/lib/constants";
import { getDictionary } from "@/lib/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const t = getDictionary(raw);
  return {
    title: t.meta.title,
    description: t.meta.description,
    keywords: t.meta.keywords.split(",").map((k) => k.trim()),
    alternates: {
      canonical: `${SITE.domain}/${raw}/`,
      languages: {
        fr: `${SITE.domain}/fr/`,
        en: `${SITE.domain}/en/`,
        "x-default": `${SITE.domain}/fr/`,
      },
    },
    openGraph: {
      locale: raw === "fr" ? "fr_FR" : "en_US",
      title: t.meta.title,
      description: t.meta.description,
      url: `${SITE.domain}/${raw}/`,
    },
  };
}

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = getDictionary(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PagneMarket",
    url: SITE.domain,
    parentOrganization: {
      "@type": "Organization",
      name: SITE.company,
      url: SITE.companyUrl,
      address: {
        "@type": "PostalAddress",
        addressCountry: "CA",
      },
    },
    slogan: locale === "fr" ? "L'Afrique sans frontières." : "Africa without borders.",
    description: t.meta.description,
    sameAs: Object.values(SITE.social),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header locale={locale} t={t} />
      <main className="pb-20 md:pb-0">
        <Hero t={t} />
        <Sections t={t} />
      </main>
      <Footer locale={locale} t={t} />
      <StickyDownload t={t} />
    </>
  );
}
