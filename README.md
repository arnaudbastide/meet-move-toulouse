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
   Les migrations ultérieures (dont `20250210120000_enforce_role_and_vendor_policies.sql`) verrouillent le rôle des profils et
   renforcent la fonction `cancel_booking` avec une fenêtre d'annulation de 24h. Rejouez-les sur chaque environnement.
3. **Configurer les variables d'environnement**
   Copiez `.env.example` vers `.env` et complétez :
   ```bash
   cp .env.example .env
   ```
  - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont disponibles via `supabase status`.
  - `VITE_STRIPE_PUBLISHABLE_KEY` est obligatoire côté front ; l'application affiche un avertissement si la clé est absente.

## Stripe
1. **Variables d'environnement backend** (pour les fonctions Express / Edge Functions)
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

2. **Lancer le serveur de fonctions Stripe**
   ```bash
   npm run functions:dev
   ```

   Utilisez `PORT` pour changer le port local (par défaut `8787`). Un script de vérification rapide est disponible :
   ```bash
   npm run functions:health
   ```

3. **Forwarder les webhooks avec Stripe CLI**
   ```bash
   stripe listen --events account.updated,payment_intent.succeeded,payment_intent.payment_failed,charge.refunded \
     --forward-to http://localhost:8787/webhook
   ```

4. **Tester les endpoints HTTP**

   ```bash
   # Healthcheck
   curl http://localhost:8787/health

   # Créer un lien d'onboarding Stripe Express
   curl -X POST http://localhost:8787/create-account-link \
     -H 'Content-Type: application/json' \
     -d '{
       "profileId": "<vendor-profile-id>",
       "refreshUrl": "http://localhost:5173/vendor-dashboard",
       "returnUrl": "http://localhost:5173/vendor-dashboard",
       "email": "vendor@example.com"
     }'

   # Créer un PaymentIntent (l'entête Idempotency-Key est optionnelle mais recommandée)
   curl -X POST http://localhost:8787/create-payment-intent \
     -H 'Content-Type: application/json' \
     -H 'Idempotency-Key: slot-<slot-id>-user@example.com' \
     -d '{
       "slotId": "<slot-id>",
       "customerEmail": "user@example.com"
     }'

   # Attacher un booking à un PaymentIntent (après l'appel RPC book_slot)
   curl -X POST http://localhost:8787/attach-booking-transfer \
     -H 'Content-Type: application/json' \
     -d '{
       "bookingId": "<booking-id>",
       "paymentIntentId": "<pi-id>"
     }'
   ```

   Pour simuler les webhooks Stripe côté local, utilisez la commande Stripe CLI ci-dessus ou `stripe trigger payment_intent.succeeded`.

5. **Onboarding vendor**
   - Utilisez l'endpoint `/create-account-link` pour créer l'URL d'onboarding Stripe Express.
   - Dans l'application, ouvrez le tableau vendor (`/vendor-dashboard`) et utilisez la carte « Statut Stripe » pour démarrer ou
     reprendre l'onboarding depuis l'interface.

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

## Parcours MVP à vérifier
1. **Seed + migrations** : exécuter `supabase migration up` puis `supabase db query < supabase/seed.sql`.
2. **Vendor** : connecter le compte demo vendor, finaliser l'onboarding Stripe depuis `/vendor-dashboard` et vérifier que la
   page `/create` reste verrouillée tant que l'onboarding n'est pas terminé.
3. **Création** : créer un événement (créneaux > 24h) et constater les statistiques dans `/vendor-dashboard` une fois
   l'onboarding complété.
4. **User** : réserver un créneau via `/event/:id`, finaliser le paiement, puis annuler la réservation avant la limite de 24h.
   Vérifier qu'une tentative d'annulation hors délai affiche le toast explicite.
5. **E2E** : lancer `pnpm test:e2e` pour valider l'enchaînement complet (inscriptions, paiement mocké, annulation, webhook).

## Déploiement Vercel
1. Définir les variables d'environnement `VITE_*` dans Vercel.
2. Ajouter les secrets Stripe et Supabase pour les fonctions (`functions/index.ts`).
3. Activer le support Edge Functions ou déployer les fonctions Express via un Worker/Serverless (Vercel, Fly, etc.).
4. Déployer :
   ```bash
   vercel deploy
   ```

L'application est PWA-ready grâce à `vite-plugin-pwa`.
