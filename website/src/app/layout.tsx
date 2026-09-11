import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pagnemarket.com"),
  title: {
    default: "PagneMarket — L'Afrique sans frontières",
    template: "%s · PagneMarket",
  },
  description:
    "PagneMarket connecte les communautés du monde autour du pagne, des tissus africains, de la mode, des créateurs et du savoir-faire africain.",
  applicationName: "PagneMarket",
  authors: [{ name: "Export Monde Prestige Inc." }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    url: "https://pagnemarket.com",
    siteName: "PagneMarket",
    title: "PagneMarket — L'Afrique sans frontières",
    description:
      "PagneMarket connecte les communautés du monde autour du pagne, des tissus africains, de la mode, des créateurs et du savoir-faire africain.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1594737625785-c668baea5dee?auto=format&fit=crop&w=1200&q=80",
        width: 1200,
        height: 630,
        alt: "PagneMarket",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PagneMarket — L'Afrique sans frontières",
    description:
      "Connecter l'Afrique, sa diaspora et le monde autour du textile et de la culture africaine.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-ivory font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
