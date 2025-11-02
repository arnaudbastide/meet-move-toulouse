# Meet & Move

A full-stack application for creating and booking local events in Toulouse. Built with React, Supabase, and Stripe for seamless event management and payment processing.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, React Query, Zod, React Hook Form, Stripe Elements
- **Backend:** Supabase (Postgres, Auth, RLS), Express, Stripe
- **Testing:** Vitest, Playwright

## Features

- **Vendor Dashboard:** Create events, manage bookings, view revenue statistics
- **Event Booking:** Users can browse and book events with Stripe payment integration
- **Role-Based Access:** Separate vendor and user roles with appropriate permissions
- **Stripe Onboarding:** Vendors complete Stripe Express account setup to receive payments
- **Booking Management:** Users can cancel bookings (with 24h cancellation window)
- **French Localization:** Complete French UI for local users

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm (recommended) or npm
- Supabase CLI (for local development)
- Stripe CLI (for webhook testing)
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd meet-move-toulouse
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   **Frontend (.env):**
   ```bash
   cp .env.example .env
   ```

   Fill in the following variables:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
   VITE_FUNCTIONS_URL=http://localhost:8787
   ```

   **Backend (supabase/functions/.env):**
   ```bash
   cp supabase/functions/.env.example supabase/functions/.env
   ```

   Fill in the following variables:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   PORT=8787
   ```

4. **Set up Supabase**

   **Local Development:**
   ```bash
   # Start Supabase locally
   supabase start
   
   # Apply migrations
   supabase db reset
   
   # Seed the database with demo data
   pnpm seed
   ```

   **Production:**
   - Create a project on [Supabase](https://supabase.com)
   - Run migrations: `supabase db push`
   - Update your `.env` files with production URLs and keys

5. **Run the application**

   ```bash
   # Terminal 1: Start backend functions server
   pnpm functions:dev

   # Terminal 2: Start frontend development server
   pnpm dev
   ```

   The frontend will be available at `http://localhost:5173`

### Seeding Demo Data

The seed script creates demo users and events for testing:

```bash
pnpm seed
```

This creates:
- Demo vendor: `vendor.demo@meet-move.local` / `ChangeMe123!`
- Demo user: `user.demo@meet-move.local` / `ChangeMe123!`
- 5 example events with slots
- Vendor account with Stripe onboarding complete

### Stripe Webhook Setup

For local development with Stripe webhooks:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

# Forward webhooks to local server
stripe listen --forward-to localhost:8787/webhook

# This will provide a webhook signing secret to add to your .env file
```

### Testing

**Unit Tests (Vitest):**
```bash
pnpm test
```

**End-to-End Tests (Playwright):**
```bash
# Run in headed mode
pnpm test:e2e

# Run in CI mode (headless)
pnpm test:e2e -- --reporter=list
```

**Linting:**
```bash
pnpm lint
```

**Type Checking:**
```bash
pnpm exec tsc -b
```

## Available Scripts

- `pnpm dev` - Start Vite dev server
- `pnpm build` - Build for production (typecheck + vite build)
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm test` - Run unit tests with Vitest
- `pnpm test:e2e` - Run E2E tests with Playwright
- `pnpm functions:dev` - Start Express backend server
- `pnpm seed` - Seed database with demo data

## Project Structure

```
meet-move-toulouse/
├── src/
│   ├── components/      # React components
│   ├── routes/          # Page components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and configs
│   ├── contexts/        # React contexts (Auth)
│   └── integrations/    # Supabase client setup
├── supabase/
│   ├── migrations/      # Database migrations
│   ├── functions/       # Express backend API
│   └── config.toml      # Supabase config
├── scripts/             # Utility scripts (seed, health-check)
├── tests/               # E2E tests
└── public/              # Static assets
```

## Deployment

### Frontend (Vercel)

1. **Push your code to GitHub**

2. **Import project in Vercel:**
   - Connect your GitHub repository
   - Framework preset: Vite
   - Root directory: `.` (or leave default)

3. **Configure environment variables:**
   ```
   VITE_SUPABASE_URL=your-production-url
   VITE_SUPABASE_ANON_KEY=your-production-anon-key
   VITE_SUPABASE_PUBLISHABLE_KEY=your-production-anon-key
   VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
   VITE_FUNCTIONS_URL=https://your-functions-url.com
   ```

4. **Deploy:**
   - Vercel will automatically deploy on push to main

### Backend Functions (Railway/Render/Fly.io)

1. **Set up your hosting platform**

2. **Configure environment variables:**
   ```
   SUPABASE_URL=your-production-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_WEBHOOK_SECRET=your-webhook-secret
   PORT=8787
   ```

3. **Build command:** `pnpm install && pnpm build` (if needed)
4. **Start command:** `pnpm functions:dev`

### Stripe Webhooks (Production)

1. **Set up webhook endpoint** in Stripe Dashboard:
   - URL: `https://your-functions-url.com/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`

2. **Copy webhook signing secret** to your backend `.env`

## Development Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test locally:**
   ```bash
   pnpm dev
   pnpm functions:dev
   ```

3. **Run tests:**
   ```bash
   pnpm test
   pnpm lint
   ```

4. **Commit and push:**
   ```bash
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**

## Troubleshooting

**Issue: Dependencies not installing**
- Solution: Remove `node_modules` and `pnpm-lock.yaml`, then run `pnpm install`

**Issue: Supabase connection errors**
- Solution: Verify your `.env` file has correct Supabase URL and keys

**Issue: Stripe webhooks not working**
- Solution: Ensure webhook secret is set correctly and Stripe CLI is forwarding events

**Issue: Port already in use**
- Solution: Change port in `vite.config.ts` or kill the process using port 5173

## License

Private project - All rights reserved

## Contributing

This is a private project. For contributions, please contact the project maintainers.
