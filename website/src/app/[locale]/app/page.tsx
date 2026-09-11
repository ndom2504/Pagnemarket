"use client";

import { StoreBadges, TrackLink } from "@/components/Cta";
import { SITE, type Locale, isLocale } from "@/lib/constants";
import { getDictionary } from "@/lib/content";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function AppDownloadPage() {
  const params = useParams<{ locale: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : "fr";
  const t = getDictionary(locale);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
    else if (/Android/i.test(ua)) setPlatform("android");
    else setPlatform("desktop");
  }, []);

  useEffect(() => {
    if (platform === "ios" && SITE.appStoreUrl !== SITE.appUrl) {
      window.location.replace(SITE.appStoreUrl);
    } else if (platform === "android" && SITE.playStoreUrl !== SITE.appUrl) {
      window.location.replace(SITE.playStoreUrl);
    }
  }, [platform]);

  const message = useMemo(() => {
    if (platform === "ios") return t.appPage.ios;
    if (platform === "android") return t.appPage.android;
    return t.appPage.desktop;
  }, [platform, t]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-5 py-16 text-center text-ivory">
      <p className="font-display text-4xl md:text-5xl">PagneMarket</p>
      <h1 className="mt-6 font-display text-3xl md:text-4xl">{t.appPage.title}</h1>
      <p className="mt-4 max-w-md text-ivory/70">{t.appPage.subtitle}</p>
      <p className="mt-8 text-sm uppercase tracking-[0.16em] text-gold">{message}</p>
      <div className="mt-8">
        <StoreBadges />
      </div>
      <TrackLink
        event="app_download_click"
        className="mt-8 inline-flex rounded-full bg-ivory px-6 py-3 text-sm text-ink"
      >
        {t.app.cta}
      </TrackLink>
      <Link href={`/${locale}/`} className="mt-10 text-sm text-ivory/55 hover:text-ivory">
        {t.appPage.back}
      </Link>
    </main>
  );
}
