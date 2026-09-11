export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const SITE = {
  name: "PagneMarket",
  domain: "https://pagnemarket.com",
  company: "Export Monde Prestige Inc.",
  companyUrl: "https://exportmondeprestigeinc.com/",
  appUrl: "https://pagnemarket.com/app",
  // Remplacer quand les stores seront publiés
  appStoreUrl: "https://pagnemarket.com/app",
  playStoreUrl: "https://pagnemarket.com/app",
  contactEmail: "info@misterdil.ca",
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/",
    youtube: "https://youtube.com/",
    whatsapp: "https://wa.me/",
  },
} as const;

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}
