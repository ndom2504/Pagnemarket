# PagneMarket Website

Landing marketing pour **pagnemarket.com** — Export Monde Prestige Inc.

## Développement

```bash
cd website
npm install
npm run dev
```

Ouvrir http://localhost:3000/fr/

## Build statique

```bash
npm run build
```

Sortie dans `website/out/`.

## Déploiement Vercel (domaine pagnemarket.com)

1. Créer un projet Vercel avec **Root Directory** = `website`
2. Build : `npm run build` / Output : `out` (déjà dans `website/vercel.json`)
3. Lier le domaine `pagnemarket.com` (+ `www`)
4. Quand les apps stores sont prêts, mettre à jour dans `src/lib/constants.ts` :
   - `appStoreUrl`
   - `playStoreUrl`

L’API reste sur le projet Vercel existant (`/api`). Ce site marketing est un projet séparé pointant vers le même repo, dossier `website`.

## URLs

| URL | Rôle |
|-----|------|
| `/fr/` | Landing FR |
| `/en/` | Landing EN |
| `/app` | Hub téléchargement (redirige iOS/Android quand les stores sont configurés) |
