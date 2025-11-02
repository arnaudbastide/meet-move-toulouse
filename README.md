# Meet & Move Toulouse

Plateforme de réservation d'événements pour Toulouse avec tableau vendeur, paiements Stripe Connect et expérience localisée en français.

## Fonctionnalités

- Navigation conditionnelle selon le rôle (visiteur, utilisateur, vendeur)
- Tableau vendeur avec revenus, réservations et statut d'onboarding Stripe
- Création d'événements avec créneaux multiples, géolocalisation et capacité
- Réservations côté utilisateur avec paiement Stripe et annulation < 24h
- Scripts d'ensemencement Supabase pour jeux de données réalistes
- Tests unitaires (Vitest) et end-to-end (Playwright)

## Tech Stack

- **Frontend** : React 18, Vite, TypeScript, shadcn/ui, Tailwind CSS
- **State** : TanStack Query
- **Backend** : Supabase (Postgres + Auth + RLS)
- **Payments** : Stripe Connect + Stripe Elements
- **Forms** : React Hook Form + Zod
- **Tests** : Vitest + Playwright
- **Fonctions** : Express.js (Supabase Edge Functions)

## Prérequis

- Node.js 18 LTS ou 20 LTS
- pnpm 8+
- Supabase CLI (pour lancer l'instance locale)
- Stripe CLI (pour relayer les webhooks en local)
- Docker (nécessaire pour Supabase local)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meet-move-toulouse
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

## Configuration des variables d'environnement

### Frontend (`.env`)

Créez un fichier `.env` à la racine avec :

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=public-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_FUNCTIONS_URL=http://localhost:8787
```

Vous pouvez également ajouter `VITE_SUPABASE_ANON_KEY` si vous souhaitez garder l'ancien nommage ; les deux sont pris en charge.

### Fonctions + scripts (`supabase/functions/.env`)

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=8787
```

Les scripts Node (ex. `pnpm seed`) consomment aussi ces variables via `dotenv`.

## Supabase

1. **Lancer Supabase en local**
   ```bash
   supabase start
   ```
   Vous obtiendrez l'URL, la clé anonyme et la clé service role.

2. **Appliquer les migrations**
   ```bash
   supabase db reset
   ```
   Cette commande nettoie et applique toutes les migrations présentes dans `supabase/migrations/`.

3. **Projet Supabase Cloud**
   - Créez un projet sur https://supabase.com pour l'environnement de prod
   - Copiez l'URL et les clés dans vos fichiers `.env`

## Stripe

1. **Compte & clés**
   - Créez un compte sur https://stripe.com
   - Récupérez vos clés API (mode test pour le dev)

2. **Webhooks en local**
   ```bash
   stripe listen --forward-to http://localhost:8787/webhook
   ```
   Notez le `STRIPE_WEBHOOK_SECRET` fourni et ajoutez-le dans `supabase/functions/.env`.

3. **Cartes de test**
   - Utilisez les cartes fournies par Stripe : https://stripe.com/docs/testing
   - Le mode e2e active un `__STRIPE_TEST_MODE__` pour simuler la confirmation.

## Lancer l'application

1. (Optionnel) démarrez Supabase en local  
   `supabase start`

2. Lancez le serveur de fonctions (Express + Stripe helpers)  
   ```bash
   pnpm functions:dev
   ```

3. Dans un autre terminal, démarrez l'écoute Stripe  
   ```bash
   stripe listen --forward-to http://localhost:8787/webhook
   ```

4. Lancez le front Vite sur `http://localhost:5173`  
   ```bash
   pnpm dev
   ```

### Autres commandes utiles

- `pnpm build` : build production (`dist/`)
- `pnpm preview` : prévisualiser le build
- `pnpm lint` : ESLint
- `pnpm seed` : exécuter le script d'ensemencement

## Données de démonstration

```bash
pnpm seed
```

Le script crée :
- un vendeur démo (`vendor.demo@meet-move.local` / `ChangeMe123!`)
- un utilisateur démo (`user.demo@meet-move.local` / `ChangeMe123!`)
- cinq événements `[SEED]` avec 2 à 3 créneaux à venir

Le script est idempotent : les anciens événements `[SEED]` sont purgés avant réinsertion et les comptes sont upsert.

## Tests

### Unit tests (Vitest)

```bash
pnpm test
```

### End-to-end (Playwright)

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Pré-requis :
- Supabase et les fonctions doivent être en cours d'exécution
- Stripe CLI doit relayer les webhooks (`stripe listen ...`)
- Le flux Playwright active `window.__STRIPE_TEST_MODE__` pour simuler la confirmation de paiement

## Stripe CLI : simulations utiles

```bash
# Confirmer un paiement (met à jour bookings.status -> booked)
stripe trigger payment_intent.succeeded

# Simuler un échec de paiement (bookings.status -> cancelled)
stripe trigger payment_intent.payment_failed

# Mettre à jour le statut d'onboarding d'un compte vendeur
stripe trigger account.updated
```

Ces commandes nécessitent `stripe listen` en cours d'exécution et fonctionnent avec les clés de test.

## Déploiement

### Frontend (Vercel, Netlify, etc.)
- Construisez via `pnpm build`
- Configurez les variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_FUNCTIONS_URL`

### Fonctions Express (Fly.io, Render, Railway)
- Déployez `supabase/functions/index.ts` via un service Node 18/20
- Variables nécessaires : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PORT`
- Configurez l'endpoint webhook Stripe vers `https://<votre-service>/webhook`

### Base de données

```bash
supabase db push
```

Pousse les migrations vers votre instance distante.

## CI/CD

Le workflow GitHub Actions (`.github/workflows/ci.yml`) :
- installe les dépendances via pnpm avec cache
- exécute lint (`pnpm lint`), type-check (`pnpm exec tsc -b`) et tests unitaires (`pnpm test`)
- lance les tests end-to-end (`pnpm test:e2e`) uniquement sur la branche `main`

Or use the Supabase Dashboard to run SQL migrations.

## Environment Variables Reference

### Frontend (.env)
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `VITE_FUNCTIONS_URL`: Functions server URL (local or production)

### Backend (.env.server)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (bypasses RLS)
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `PORT`: Functions server port (default: 8787)

## Troubleshooting

### Windows BOM in .env Files

If you encounter issues with `.env` files on Windows:
- Use a text editor that supports UTF-8 without BOM
- Or use WSL/Linux for development

### Docker Not Running

Supabase requires Docker. Ensure Docker Desktop is running before:
```bash
supabase start
```

### Port Conflicts

If ports are already in use:
- Change `PORT` in `.env.server` (functions)
- Change `server.port` in `vite.config.ts` (frontend)

### Stripe Webhook Issues

- Ensure Stripe CLI is forwarding webhooks: `stripe listen --forward-to http://localhost:8787/webhook`
- Check webhook secret matches in `.env.server`
- Verify webhook endpoint is accessible

### Permission Errors

- Ensure `SUPABASE_SERVICE_ROLE_KEY` has proper permissions
- Check RLS policies are set up correctly
- Verify database roles are assigned

## Project Structure

```
meet-move-toulouse/
├── src/
│   ├── components/          # React components
│   ├── contexts/            # React contexts (Auth, Events)
│   ├── hooks/               # Custom React hooks
│   ├── integrations/       # Supabase client
│   ├── lib/                 # Utilities and types
│   ├── pages/               # Page components
│   ├── routes/              # Route components
│   └── App.tsx              # Main app component
├── supabase/
│   ├── functions/           # Edge functions (Express)
│   └── migrations/          # Database migrations
├── scripts/
│   ├── seed.ts              # Database seeding script
│   └── utils/               # Script utilities
├── tests/                   # E2E tests (Playwright)
└── public/                  # Static assets
```

## Features

### For Users
- Browse events in Toulouse
- Book event slots with Stripe payment
- Manage bookings (view/cancel)
- Cancel bookings up to 24h before the slot

### For Vendors
- Create and manage events
- Set pricing and capacity
- Track bookings and revenue
- Stripe Connect onboarding
- Dashboard with statistics

### Technical Features
- Role-based access control (vendor/user)
- Soft route guards with friendly messages
- Stripe Connect for marketplace payments
- Real-time booking updates
- Idempotent webhook handling

## License

MIT
