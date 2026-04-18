# cbc-hackathon

Ambient, itinerary-aware health coach. Combines Google Calendar, location, and
user goals to push context-specific nutritional advice over WhatsApp and a web
dashboard. See [PLAN.md](./PLAN.md) for the full product + build plan.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- Better Auth (Google social provider + Calendar scopes)
- Supabase (Postgres) via `DATABASE_URL`
- Anthropic SDK (Claude Opus 4.7 + Haiku 4.5)
- Twilio WhatsApp sandbox
- Google Places + Google Calendar APIs

## Setup

Prereqs: Node 20+, pnpm 10+.

```bash
pnpm install
cp .env.example .env.local
# fill in secrets — see .env.example for the full list
pnpm dev
```

Generate a Better Auth secret:

```bash
openssl rand -base64 32
```

## Scripts

- `pnpm dev` — start Next dev server at http://localhost:3000
- `pnpm build` — production build
- `pnpm lint` — eslint
- `pnpm exec tsc --noEmit` — typecheck
