# Meet & Move Toulouse

A full-stack event booking platform connecting people in Toulouse. Built with React, TypeScript, Supabase, and Stripe.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Payments**: Stripe Connect
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Functions**: Express.js (Supabase Edge Functions)

## Prerequisites

- **Node.js**: 18+ or 20+ (recommended)
- **npm**: 9+ or 10+
- **Supabase CLI**: Latest version
- **Stripe CLI**: Latest version (for local webhook forwarding)
- **Docker**: Required for local Supabase instance

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meet-move-toulouse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create `.env` in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   VITE_FUNCTIONS_URL=http://localhost:8787
   ```

   Create `.env.server` in the root directory (for functions and seed scripts):
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   PORT=8787
   ```

## Supabase Setup

1. **Start local Supabase**
   ```bash
   supabase start
   ```

   This will:
   - Start a local PostgreSQL database
   - Start the Supabase API
   - Print your local credentials

2. **Run migrations**
   ```bash
   supabase db reset
   ```

   This applies all migrations in `supabase/migrations/`.

3. **Create a project on Supabase Cloud** (for production)
   - Go to https://supabase.com
   - Create a new project
   - Copy your project URL and API keys to `.env`

## Stripe Setup

1. **Create a Stripe account**
   - Sign up at https://stripe.com
   - Get your API keys from the Dashboard

2. **Set up local webhook forwarding** (for development)
   ```bash
   stripe listen --forward-to http://localhost:8787/webhook
   ```

   This will:
   - Forward Stripe webhooks to your local functions server
   - Print a webhook signing secret (add to `.env.server`)

3. **Test mode**
   - Use test mode API keys for development
   - Use test cards from https://stripe.com/docs/testing

## Running the Application

### Development

1. **Start Supabase** (if using local instance)
   ```bash
   supabase start
   ```

2. **Start the functions server**
   ```bash
   npm run functions:dev
   ```

   This starts the Express server at `http://localhost:8787`.

3. **Start Stripe webhook forwarding** (in another terminal)
   ```bash
   stripe listen --forward-to http://localhost:8787/webhook
   ```

4. **Start the frontend**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

This serves the production build locally for testing.

## Database Seeding

Seed the database with demo users and events:

```bash
npm run seed
```

This creates:
- A demo vendor user (`vendor.demo@meet-move.local`)
- A demo regular user (`user.demo@meet-move.local`)
- 5 example events with 2-3 slots each

**Note**: The seed script is idempotent. Running it multiple times will remove previous seed events and recreate them.

## Testing

### Unit Tests (Vitest)

```bash
npm test
```

Tests are located in `src/**/__tests__/` directories.

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

Tests are located in `tests/` directory.

**Note**: E2E tests require a running Supabase instance and may use mocked Stripe calls.

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables (VITE_* prefixed)
4. Deploy

### Functions (Render/Fly.io)

1. Set up a Node.js service
2. Set environment variables (without VITE_ prefix)
3. Point to your Supabase project
4. Configure Stripe webhook endpoint

### Database Migrations

Run migrations on production:

```bash
supabase db push
```

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
