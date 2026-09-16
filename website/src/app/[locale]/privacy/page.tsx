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
    title: fr ? "Politique de confidentialité" : "Privacy Policy",
    description: fr
      ? "Politique de confidentialité de l’application et du site PagneMarket."
      : "Privacy policy for the PagneMarket app and website.",
    alternates: {
      canonical: `${SITE.domain}/${raw}/privacy`,
      languages: {
        fr: `${SITE.domain}/fr/privacy`,
        en: `${SITE.domain}/en/privacy`,
      },
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const fr = locale === "fr";

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="font-display text-sm tracking-wide text-ink/50">
        <Link href={`/${locale}`} className="hover:text-ink">
          PagneMarket
        </Link>
        {" / "}
        {fr ? "Confidentialité" : "Privacy"}
      </p>
      <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
        {fr ? "Politique de confidentialité" : "Privacy Policy"}
      </h1>
      <p className="mt-3 text-sm text-ink/60">
        {fr ? "Dernière mise à jour : 15 septembre 2026" : "Last updated: September 15, 2026"}
      </p>

      <div className="prose prose-neutral mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-ink/85">
        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "1. Qui nous sommes" : "1. Who we are"}
          </h2>
          <p>
            {fr
              ? `PagneMarket est édité par ${SITE.company}. Contact : `
              : `PagneMarket is operated by ${SITE.company}. Contact: `}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "2. Données collectées" : "2. Data we collect"}
          </h2>
          <p>
            {fr
              ? "Selon l’usage de l’app, nous pouvons collecter :"
              : "Depending on how you use the app, we may collect:"}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {fr
                ? "Identité et compte : nom, e-mail, numéro de téléphone, photo de profil"
                : "Identity and account: name, email, phone number, profile photo"}
            </li>
            <li>
              {fr
                ? "Connexion sociale : Google ou Sign in with Apple (identifiant et e-mail fournis)"
                : "Social login: Google or Sign in with Apple (identifier and provided email)"}
            </li>
            <li>
              {fr
                ? "Contenu marketplace : annonces, créations, commandes, messages"
                : "Marketplace content: listings, creations, orders, messages"}
            </li>
            <li>
              {fr
                ? "Paiements : informations de transaction via nos prestataires (ex. Stripe) — nous ne stockons pas les numéros de carte complets"
                : "Payments: transaction details via providers (e.g. Stripe) — we do not store full card numbers"}
            </li>
            <li>
              {fr
                ? "Données techniques : appareil, journaux d’erreurs, jetons de notification push"
                : "Technical data: device info, error logs, push notification tokens"}
            </li>
            <li>
              {fr
                ? "Photos : lorsque vous choisissez d’uploader via la caméra ou la galerie"
                : "Photos: when you choose to upload via camera or photo library"}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "3. Finalités" : "3. How we use data"}
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {fr
                ? "Créer et gérer votre compte (acheteur, fournisseur ou tailleur)"
                : "Create and manage your account (buyer, supplier, or tailor)"}
            </li>
            <li>
              {fr
                ? "Permettre les commandes, la messagerie et le suivi atelier"
                : "Enable orders, messaging, and tailor workflow"}
            </li>
            <li>
              {fr
                ? "Envoyer des notifications liées aux commandes et messages"
                : "Send notifications about orders and messages"}
            </li>
            <li>
              {fr
                ? "Sécuriser la plateforme et prévenir la fraude"
                : "Secure the platform and prevent fraud"}
            </li>
            <li>
              {fr
                ? "Améliorer le produit et le support client"
                : "Improve the product and customer support"}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "4. Partage" : "4. Sharing"}
          </h2>
          <p>
            {fr
              ? "Nous ne vendons pas vos données. Elles peuvent être partagées avec :"
              : "We do not sell your data. It may be shared with:"}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {fr
                ? "Prestataires techniques (hébergement, authentification, paiements, SMS)"
                : "Service providers (hosting, authentication, payments, SMS)"}
            </li>
            <li>
              {fr
                ? "Autres utilisateurs de la marketplace lorsque nécessaire à une transaction (ex. fournisseur / tailleur)"
                : "Other marketplace users when needed for a transaction (e.g. supplier / tailor)"}
            </li>
            <li>
              {fr
                ? "Autorités si la loi l’exige"
                : "Authorities when required by law"}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "5. Conservation et sécurité" : "5. Retention and security"}
          </h2>
          <p>
            {fr
              ? "Nous conservons les données tant que votre compte est actif, puis le temps nécessaire aux obligations légales. Des mesures techniques et organisationnelles limitent l’accès non autorisé."
              : "We keep data while your account is active, then as long as needed for legal obligations. Technical and organizational measures help prevent unauthorized access."}
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "6. Vos droits" : "6. Your rights"}
          </h2>
          <p>
            {fr
              ? `Selon votre pays, vous pouvez demander l’accès, la correction ou la suppression de vos données. Écrivez à ${SITE.contactEmail}. Sur iOS, vous pouvez aussi gérer les permissions (notifications, caméra, photos) dans Réglages.`
              : `Depending on your country, you may request access, correction, or deletion of your data. Email ${SITE.contactEmail}. On iOS you can also manage permissions (notifications, camera, photos) in Settings.`}
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "7. Enfants" : "7. Children"}
          </h2>
          <p>
            {fr
              ? "PagneMarket n’est pas destiné aux enfants de moins de 13 ans (ou l’âge minimum local applicable)."
              : "PagneMarket is not directed to children under 13 (or the applicable local minimum age)."}
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink">
            {fr ? "8. Modifications" : "8. Changes"}
          </h2>
          <p>
            {fr
              ? "Nous pouvons mettre à jour cette politique. La date en tête de page sera actualisée. L’usage continu de l’app après publication vaut prise de connaissance."
              : "We may update this policy. The date at the top will change. Continued use of the app after publication means you acknowledge the update."}
          </p>
        </section>
      </div>
    </main>
  );
}
