# Hackathon Plan — Ambient Health Coach

## Product summary

An itinerary-aware, ambient health coach that removes the guesswork from eating well in real life. The tool combines a user's calendar, location, goals, and lifestyle profile to proactively deliver context-specific nutritional advice via WhatsApp and a web dashboard. It uses a gamified quest system with cosmetic rewards to drive engagement.

Designed to work across lifestyles: traveler, student, home-based professional, retiree, shift worker, mixed.

## Core interaction model

- **Ambient + proactive, not reactive.** The tool anticipates eating windows from calendar + location and pushes advice before the user has to ask.
- **Location-based, not photo-based.** Photo-of-fridge assumes a home context that doesn't fit on-the-go users.
- **Calendar is core infrastructure**, not a stretch goal.

## Input architecture

Three layers, from frame to specifics:

1. **Itinerary-aware (frame):** Google Calendar provides the skeleton — upcoming events, times, locations.
2. **Venue-type resolver (middle):** Each location is resolved to a venue category (airport, gas station, hotel, dining hall, home, etc.) which selects a playbook.
3. **Places API (leaves):** Google Places fills in specific restaurants, stores, or dishes.

Calendar integration: **Google Calendar** primary. **Notion Calendar** is a UI surface over Google Calendar, not a separate integration.

## Onboarding & profile

**Goal-first, then adaptive branching.** No archetype cage — goal is the universal anchor.

Flow:
1. What are you trying to achieve? (free text, stored raw)
2. Three gate questions:
   - How predictable is your week?
   - Where do most of your meals happen? (home / on-the-go / institutional dining / mix)
   - Any non-negotiables? (allergies, medical, religious, preferences)
3. Up to 2–3 adaptive follow-ups based on gate answers.

The profile drives mode-switching:
- **Travel mode:** restaurant recommendations only, no grocery suggestions.
- **Home-based mode (student, retiree, remote worker, etc.):** dual surface — eat-out suggestions and cook-at-home suggestions (with a "what do you want to make?" or auto-suggest flow).

**No interaction logging.** Profile captures lifestyle upfront; ongoing adjustments come only from explicit quest check-ins.

## Gamification: quests, challenges, rewards

**Quests** — baseline weekly loop. Auto-assigned from goal + profile, with a swap option. User never builds a streak they can be punished for breaking; quests are completable (3/5 is still a win) and reset weekly.

**Challenges** — opt-in, time-boxed extra credit ("7-day hydration challenge," "no added sugar Mon–Fri").

**Rewards:** XP accumulates toward **badges** (milestone markers) and unlocks **cosmetics** — characters, app backgrounds, skins. Coaching content is never gated; rewards are pure flair.

**Check-ins:** ✅ Done / ⏭️ Skipped / 🔄 Later — available on both WhatsApp quick-replies and the web dashboard. Both write to the same `quest_events` table.

## Differentiators (demo narrative)

1. **Itinerary-native, not reactive.** Advice before meals, not logging after.
2. **Venue-playbook intelligence.** Not a Yelp list — specific, context-aware tactics.
3. **Learns your patterns via onboarding profile** (simpler than behavioral ML; still personal).
4. **Multi-lifestyle generality.** Same engine, different playbooks per archetype — shown in the demo by switching from a Traveler account to a Student account.

Cut from scope: voice-note check-ins, "live shot" correspondent-specific feature.

## Tech stack

```
Frontend:  Next.js 14 (App Router) + Tailwind + shadcn/ui
Backend:   Next.js API routes (same repo)
AI:        Anthropic SDK
           - claude-opus-4-7 for reasoning-heavy recommendations
           - claude-haiku-4-5 for lightweight classification (venue-type)
           - Prompt caching enabled on system prompt + user profile
Auth:      Better Auth (Google social provider, Calendar scopes)
DB:        Supabase (Postgres)
WhatsApp:  Twilio WhatsApp sandbox (webhook -> API route)
Places:    Google Places API
Calendar:  Google Calendar API (tokens from Better Auth)
Hosting:   Vercel
```

## Data model

Managed by Better Auth: `users`, `accounts` (Google tokens), `sessions`.

App tables:

- **`profiles`** — `user_id`, `goal` (text, free-form), `archetype`, `mode_preferences` (jsonb), `constraints` (jsonb), `onboarding_completed_at`
- **`quests`** — `id`, `user_id`, `title`, `description`, `target` (jsonb), `status` (active | completed | swapped | expired), `assigned_at`, `expires_at`, `progress` (jsonb), `xp_reward`
- **`challenges`** — same shape as quests, plus `joined_at`, `duration_days`
- **`quest_events`** — append-only log: `user_id`, `quest_id`, `event_type`, `payload` (jsonb), `created_at`
- **`badges`** — static catalog (seed data): `id`, `name`, `description`, `icon_url`, `xp_threshold` or `unlock_condition`
- **`user_badges`** — `user_id`, `badge_id`, `earned_at`
- **`unlocks`** — cosmetic items owned: `user_id`, `item_id`, `unlocked_at`
- **`xp_ledger`** — append-only: `user_id`, `delta`, `reason`, `quest_id` (nullable), `created_at`
- **`whatsapp_messages`** — inbound/outbound log: `user_id`, `direction`, `body`, `twilio_sid`, `created_at`

Notes:
- `profiles.goal` is free text, not enum — enumerated goals exclude lifestyles.
- Cosmetics catalog lives in app code as constants; `unlocks` stores item IDs only.
- No `meal_logs` table — only quest-scoped, user-confirmed check-ins.

## Demo scope (tier B: live core + seeded history)

**Live on stage:**
- Google OAuth + Better Auth sign-in
- Google Calendar fetch (always live — no calendar seeding)
- Google Places lookup
- Claude recommendation generation (stream tokens into UI)
- Twilio WhatsApp inbound + outbound with quick-reply buttons
- Supabase writes on every check-in (update progress, award XP, check badge thresholds)
- Onboarding flow end-to-end

**Pre-seeded in Supabase:**
- Demo accounts (Traveler + Student) with completed profiles
- 1–2 weeks of past quest history
- Earned badges and partially unlocked cosmetics

**Calendar is not seeded.** Populate your real Google Calendar with the scripted demo events (early flight, layover, late hotel arrival) before demo day. This is calendar prep, not database seeding.

**Cut / out of scope:**
- Voice notes on WhatsApp
- Live-shot / camera-specific food advice
- Sleep + activity data
- Notion Calendar as a separate integration
- Meta WhatsApp Cloud API (narrate as production migration)
- Social / multi-user features

**Principle:** Avoid hardcoding responses. Seed data, don't fake flows. Hardcode only if time forces it (e.g., quest templates).

## Demo narrative (3–4 min)

1. **Problem** (15s) — persona, unpredictable schedule, eating is guesswork.
2. **Onboarding** (30s) — live walkthrough on a fresh account.
3. **Morning nudge** (45s) — real WhatsApp ping on your phone, quest check-in, dashboard updates live.
4. **In-the-moment rec** (45s) — trigger a location-based recommendation; Claude streams venue-specific advice with a Google Places pin.
5. **Quest + reward loop** (30s) — dashboard showing progress, XP, badge earned, cosmetic unlocked.
6. **Multi-lifestyle reveal** (30s) — switch to Student account; same app, different quests (dining hall, finals week). The generality kill shot.
7. **Close** (15s) — roadmap: sleep/activity, native app, Meta WhatsApp.

## Team of 5 — ownership split

- **Builder 1 — Lead / Integration:** Next.js scaffold, Vercel deploy, Better Auth + Google OAuth with Calendar scopes, repo hygiene. Owns demo rehearsal.
- **Builder 2 — AI / Backend:** Anthropic SDK, prompt design, Claude recommendation endpoint, prompt caching, quest generation logic. Owns "the brain."
- **Builder 3 — Data / Infra:** Supabase schema + migrations, quest check-in endpoint, XP/badge logic, Google Places, Google Calendar fetch helper.
- **Builder 4 — Frontend:** Dashboard, onboarding flow, quest cards, badge wall, cosmetic locker, loading/empty states. Owns what judges see.
- **Builder 5 — WhatsApp / Ambient:** Twilio sandbox, inbound webhook, outbound nudge sender, quick-reply handler, manual "trigger nudge" demo button.

Shared: seed script (Builders 3 + 4).

Syncs: two 10-minute standups/day + one full integration checkpoint at ~hour 20.

## Build order (48-hour plan)

**Hours 0–6 — Foundation**
1. Next.js app scaffolded, Tailwind + shadcn, deployed to Vercel.
2. Supabase project + schema migrated.
3. Better Auth with Google provider + Calendar scopes; sign-in creates user row.
4. Anthropic SDK installed; one working API route calls Claude with prompt caching on.

**Hours 6–16 — Core loops**
5. Onboarding flow writes to `profiles`.
6. Google Calendar fetch helper (next 7 days).
7. Google Places integration (lat/lng -> categorized places).
8. Claude recommendation endpoint (profile + calendar + location -> venue-aware rec).

**Hours 16–28 — Quest system + web UI**
9. Quest assignment logic with 6–8 quest templates in code.
10. Dashboard UI: active quests, progress bars, badges, XP, cosmetic locker.
11. Quest check-in endpoint (shared by WhatsApp + web): writes `quest_events`, updates progress, awards XP, checks badge thresholds.

**Hours 28–38 — WhatsApp + ambient push**
12. Twilio sandbox configured; inbound webhook route.
13. Morning nudge: cron or manual trigger pulls calendar, calls Claude, sends WhatsApp with quick-reply buttons.
14. Inbound quick-reply handler -> quest check-ins.

**Hours 38–44 — Seeding + polish**
15. Seed script: Traveler + Student demo accounts with profiles, past quests, badges, partial cosmetics. No calendar seeding.
16. Account switching for demo.
17. Loading states, error toasts, empty states.

**Hours 44–48 — Rehearsal + buffer**
18. Run the demo arc end-to-end 5+ times. Record a backup video.

## Risk hotspots

- **Twilio sandbox join flow:** judges' phones won't be joined. Demo only from your phone.
- **Google OAuth sensitive-scope warning:** "unverified app" screen appears. Click through in demo.
- **Vercel Cron timing:** hobby tier is hourly. Use a manual "trigger nudge" button for demo timing, not cron.
- **Webhook tunneling in dev:** set up ngrok on day one for local Twilio webhook testing.
- **Calendar dependency on demo day:** your real Google Calendar must have the scripted events populated before the demo.

## Privacy & safety

- **Policy one-liner:** Data stays in Supabase. Nothing sold. Nothing shared beyond the APIs required to function. Users can delete their account and data.
- **In-app controls:** Settings page with "Delete my data," "Disconnect Google," "Pause WhatsApp nudges."
- **Medical disclaimer:** Footer + one-time modal when a user enters medical constraints during onboarding ("Not medical advice. Consult a professional for medical dietary needs.").
- **Data minimization:** Stated retention policy on WhatsApp messages (~30 days) even if not enforced at hackathon scale.

## Roadmap (post-hackathon)

- Native iOS app with background location + push
- Meta WhatsApp Cloud API (production)
- Outlook / Apple Calendar via provider abstraction
- Sleep and activity data (Apple Health, Google Fit, Oura)
- Interaction logging + behavioral pattern detection
- Partnered real-world rewards (Sweetgreen, Cava, etc.)
- Voice-note check-ins
- Persona-specific content libraries (correspondent live-shot mode, etc.)
