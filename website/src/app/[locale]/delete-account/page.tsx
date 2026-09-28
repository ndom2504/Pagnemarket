import { SITE, type Locale, isLocale } from "@/lib/constants";
import type { Metadata } from "next";
import Link from "next/link";
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
  const fr = raw === "fr";
  return {
    title: fr ? "Supprimer mon compte PagneMarket" : "Delete my PagneMarket account",
    description: fr
      ? "Comment supprimer votre compte PagneMarket et les données associées."
      : "How to delete your PagneMarket account and associated data.",
    alternates: {
      canonical: `${SITE.domain}/${raw}/delete-account`,
      languages: {
        fr: `${SITE.domain}/fr/delete-account`,
        en: `${SITE.domain}/en/delete-account`,
      },
    },
  };
}

export default async function DeleteAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const fr = locale === "fr";
  const mailSubject = encodeURIComponent(
    fr ? "Suppression de compte PagneMarket" : "PagneMarket account deletion",
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="font-display text-sm tracking-wide text-ink/50">
        <Link href={`/${locale}`} className="hover:text-ink">
          PagneMarket
        </Link>
        {" / "}
        {fr ? "Suppression de compte" : "Account deletion"}
      </p>
      <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
        {fr ? "Supprimer mon compte PagneMarket" : "Delete my PagneMarket account"}
      </h1>
      <p className="mt-3 text-sm text-ink/60">
        {fr
          ? `Application PagneMarket — éditée par ${SITE.company}`
          : `PagneMarket app — operated by ${SITE.company}`}
      </p>

      <div className="prose prose-neutral mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-ink/85">
        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "1. Depuis l’application (immédiat)" : "1. From the app (immediate)"}
          </h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>{fr ? "Ouvrez PagneMarket et connectez-vous." : "Open PagneMarket and sign in."}</li>
            <li>
              {fr
                ? "Allez dans l’onglet Profil, puis Paramètres."
                : "Go to the Profile tab, then Settings (Paramètres)."}
            </li>
            <li>
              {fr
                ? "Dans « Zone de danger », touchez « Supprimer mon compte »."
                : "In the danger zone, tap “Supprimer mon compte” (Delete my account)."}
            </li>
            <li>
              {fr
                ? "Confirmez deux fois. Votre compte est supprimé immédiatement."
                : "Confirm twice. Your account is deleted immediately."}
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "2. Sans accès à l’application" : "2. Without access to the app"}
          </h2>
          <p>
            {fr
              ? "Envoyez un e-mail depuis l’adresse (ou en indiquant le numéro de téléphone) associée à votre compte à "
              : "Send an email from the address (or mentioning the phone number) linked to your account to "}
            <a href={`mailto:${SITE.contactEmail}?subject=${mailSubject}`}>{SITE.contactEmail}</a>
            {fr
              ? " avec l’objet « Suppression de compte PagneMarket ». Nous traitons la demande sous 30 jours maximum."
              : " with the subject “PagneMarket account deletion”. We process requests within 30 days."}
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "3. Données supprimées" : "3. Data deleted"}
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {fr
                ? "Nom, e-mail, numéro de téléphone, mot de passe et photo de profil"
                : "Name, email, phone number, password and profile photo"}
            </li>
            <li>
              {fr
                ? "Liens de connexion Google et Apple"
                : "Google and Apple sign-in links"}
            </li>
            <li>
              {fr
                ? "Favoris, panier, notifications, blocages et jetons de notification push"
                : "Favorites, cart, notifications, blocks and push notification tokens"}
            </li>
            <li>
              {fr
                ? "Profil public de boutique ou de créateur, et annonces (retirés de la plateforme)"
                : "Public shop or creator profile and listings (removed from the platform)"}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "4. Données conservées" : "4. Data retained"}
          </h2>
          <p>
            {fr
              ? "L’historique des commandes et des transactions est conservé sous forme anonymisée (sans nom ni coordonnées) pendant la durée exigée par nos obligations comptables et fiscales, au maximum 7 ans, puis supprimé. Les messages envoyés à d’autres utilisateurs restent visibles par eux, sous le nom « Compte supprimé »."
              : "Order and transaction history is kept in anonymized form (no name or contact details) for as long as required by accounting and tax obligations, up to 7 years, then deleted. Messages sent to other users remain visible to them under the name “Deleted account”."}
          </p>
        </section>

        <section>
          <p>
            {fr ? "Voir aussi notre " : "See also our "}
            <Link href={`/${locale}/privacy`}>
              {fr ? "politique de confidentialité" : "privacy policy"}
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
