# Meet & Move

This is a full-stack application for creating and booking local events.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, React Query, Zod, React Hook Form, Stripe Elements
- **Backend:** Supabase (Postgres, Auth, RLS), Express, Stripe
- **Testing:** Vitest, Playwright

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm (or npm)
- Supabase CLI
- Stripe CLI

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

   - Copy `.env.example` to `.env` and fill in the values for the frontend.
   - Copy `functions/.env.example` to `functions/.env` and fill in the values for the backend.

4. **Set up Supabase**

   - Start the Supabase services:
     ```bash
     supabase start
     ```
   - Apply the database migrations:
     ```bash
     supabase db reset
     ```

5. **Run the application**

   - Start the backend server:
     ```bash
     pnpm functions:dev
     ```
   - Start the frontend development server:
     ```bash
     pnpm dev
     ```

### Testing

- **Unit tests:**
  ```bash
  pnpm test
  ```
- **End-to-end tests:**
  ```bash
  pnpm test:e2e
  ```