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

## Business Enhancement Suggéré
Système de commission marketplace (10% configurable) déjà supporté côté modèle de données → prêt à activer une "marketplace fee" pour monétiser dès le premier volume de commandes.

## Non-inclus dans le MVP
- Paiement Stripe réel (mocké)
- Notifications push
- Dashboard admin web
- Upload photos vendeurs (images de démo Unsplash)
