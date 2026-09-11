# PagneMarket - Product Requirements Document

## Vision
Marketplace mobile premium dédiée aux tissus pagne africains, aux modèles et aux créateurs. Met en relation acheteurs, vendeurs et tailleurs à travers l'Afrique et l'international.

## MVP Scope (Livré)
1. **Auth** – Email/mot de passe + JWT, inscription avec choix de rôle (buyer/vendor/tailor), token stocké via storage.secureSet.
2. **Home** – Hero éditorial, catégories horizontales, tendances, créateurs vedettes, modèles populaires.
3. **Boutique** – Filtres par catégorie, recherche live, tri (nouveauté, prix, notation).
4. **Fiche produit** – Galerie paginée, badge promo, sticky glass CTA "Ajouter au panier / Acheter".
5. **Modèles** – Galerie plein écran par tailleurs avec filtres catégorie et CTA "Je veux ce modèle".
6. **Profil créateur** – Cover + avatar, stats, onglets Modèles/Bio, contact intégré (envoi message).
7. **Panier** – Modification quantité, sous-total, livraison, total, checkout.
8. **Checkout** – Adresse, mode paiement (Carte / Mobile Money — mock), confirmation.
9. **Messages** – Liste conversations, vide → suggestions de tailleurs.
10. **Profil** – Stats, commandes récentes, favoris, menu compte, déconnexion.

## Stack
- Frontend: Expo Router (React Native), TanStack Query, expo-image, expo-linear-gradient, expo-blur, @react-native-vector-icons/feather.
- Backend: FastAPI + Motor (MongoDB), JWT (pyjwt) + bcrypt.
- Devise: FCFA (XAF), langue: Français.

## Itération 2 (Livré)
11. **Fournisseur** (ex-« vendeur ») – rôle `supplier`, champ `shopName`, produits avec `supplierId/supplierName`.
12. **Espace fournisseur** – `/supplier` : ventes du jour en direct, commandes en cours, CA total, graphique 7 jours, top tissus, commandes récentes avec changement de statut (Confirmée → En préparation → Expédiée → Livrée / Annulée). `/supplier/products` (liste, édition, suppression), `/supplier/product-form` (création/édition).
13. **Photos fournisseur** – PhotoPicker caméra/galerie (expo-image-picker) avec flux permissions (explication → demande → réglages), upload via Emergent Object Storage (`POST /api/uploads/image`, `GET /api/files/{id}`).
14. **Mobile Money** – Orange / MTN / Moov via CinetPay (`routers/payments.py`) : init → page opérateur → polling statut → webhook. **Mode simulation automatique** tant que `CINETPAY_APIKEY` et `CINETPAY_SITE_ID` sont vides dans `backend/.env` (PAID après ~6 s).
15. **Pour vous** – recommandations personnalisées (`GET /api/recommendations`) basées sur les vues (`POST /api/events/view`) et les favoris ; rangée dédiée sur l'accueil.

## Backend structure
- `deps.py` (db, JWT, current_user/current_supplier), `storage.py` (Object Storage), `routers/{payments,supplier,uploads,reco}.py`, `server.py` (auth, catalogue, panier, favoris, commandes, messages, seed).

## Comptes démo
- Acheteur : demo@pagnemarket.com / Demo1234!
- Fournisseur : fournisseur@pagnemarket.com / Fournisseur1234! (Maison Adjoua)

## Itération 3 (Livré)
16. **Suivi de commande acheteur** – `/orders` (liste) et `/order/[id]` (timeline en direct Confirmée → En préparation → Expédiée → Livrée, horodatée via `statusHistory`, rafraîchissement 15 s). Le stock est décrémenté à chaque commande payée.
17. **Avis tissus** – après livraison, « Noter ce tissu » (1-5 étoiles + commentaire, un avis par tissu/commande) ; note moyenne du produit recalculée ; section « Avis des acheteurs » sur la fiche produit (`POST /api/reviews`, `GET /api/products/{id}/reviews`).
18. **Alertes stock bas** – bannière in-app sur le dashboard fournisseur quand un tissu passe sous 3 pièces (`GET /api/supplier/alerts`), bouton Réapprovisionner → formulaire d'édition ; badge « Stock bas » dans Mes tissus.

19. **Paramètres du compte** – `/settings` : photo de profil (caméra/galerie, recadrage carré, upload Object Storage, `PUT /api/auth/me`), prénom/nom/téléphone/ville/pays, nom de boutique (fournisseur, propagé aux produits). Avatar affiché dans le Profil.

## Business Enhancement Suggéré
Système de commission marketplace (10% configurable) déjà supporté côté modèle de données → prêt à activer une "marketplace fee" pour monétiser dès le premier volume de commandes.

## Non-inclus / à venir
- Paiement carte réel (mocké) ; Mobile Money réel nécessite les clés CinetPay (APIKEY + SITE_ID)
- Notifications push
- Dashboard admin web
