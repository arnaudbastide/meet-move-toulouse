# Meet & Move – React + Supabase MVP

Meet & Move est une plateforme à deux rôles (vendor ou user) permettant de créer et réserver des évènements locaux avec paiement Stripe Connect Express.

## Sommaire
- [Stack](#stack)
- [Prérequis](#prérequis)
- [Installation locale](#installation-locale)
- [Supabase](#supabase)
- [Stripe](#stripe)
- [Jeux de données de départ](#jeux-de-données-de-départ)
- [Tests end-to-end](#tests-end-to-end)
- [Déploiement Vercel](#déploiement-vercel)

## Stack
- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Auth + Edge Functions)
- Stripe Connect Express
- React Query, React Hook Form, Zod, React Leaflet
- Playwright pour les tests e2e

## Prérequis
- Node.js 18+
- pnpm (recommandé) ou npm
- Supabase CLI (`npm install -g supabase`)
- Stripe CLI (`brew install stripe/stripe-cli/stripe` ou via npm)

## Installation locale
```bash
pnpm install
pnpm dev
```
L'application est servie sur http://localhost:5173.

> **Astuce :** pour utiliser `npm`, remplacez `pnpm` par `npm run`.

## Supabase
1. **Initialiser Supabase localement**
   ```bash
   supabase start
   ```
2. **Appliquer la migration**
   ```bash
   supabase migration up
   ```
   La migration `supabase/migrations/001_vendor_user_event.sql` crée toutes les tables, politiques RLS et RPCs nécessaires.
3. **Configurer les variables d'environnement**
   Copiez `.env.example` vers `.env` et complétez :
   ```bash
   cp .env.example .env
   ```
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont disponibles via `supabase status`.

## Stripe
1. **Variables d'environnement backend** (pour les fonctions Express / Edge Functions)
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Lancer le serveur de fonctions Stripe**
   ```bash
   node functions/index.ts
   ```

3. **Forwarder les webhooks avec Stripe CLI**
   ```bash
   stripe listen --events account.updated,payment_intent.succeeded,payment_intent.payment_failed,charge.refunded \
     --forward-to http://localhost:8787/webhook
   ```

4. **Onboarding vendor**
   - Utilisez l'endpoint `/create-account-link` pour créer l'URL d'onboarding Stripe Express.

## Jeux de données de départ
- `supabase/seed.sql` ajoute un vendor et un user de démonstration.
- Exécuter :
  ```bash
  supabase db query < supabase/seed.sql
  ```
  ou collez le contenu dans l'éditeur SQL Supabase.

## Tests end-to-end
1. Démarrer l'application : `pnpm dev`
2. Lancer les tests Playwright :
   ```bash
   pnpm test:e2e
   ```

Le fichier `tests/e2e.spec.ts` couvre :
- Inscription vendor → création d'évènement → ajout de créneau → déconnexion
- Inscription user → réservation + paiement (mock Stripe) → annulation → traitement du webhook

> **Note :** Les tests supposent un backend Supabase en fonctionnement avec une base réinitialisée. Adaptez les identifiants si nécessaire.

## Déploiement Vercel
1. Définir les variables d'environnement `VITE_*` dans Vercel.
2. Ajouter les secrets Stripe et Supabase pour les fonctions (`functions/index.ts`).
3. Activer le support Edge Functions ou déployer les fonctions Express via un Worker/Serverless (Vercel, Fly, etc.).
4. Déployer :
   ```bash
   vercel deploy
   ```

L'application est PWA-ready grâce à `vite-plugin-pwa`.
