-- Ambient Health Coach — app schema
-- Apply via: Supabase Dashboard → SQL Editor → paste + run
-- Idempotent: safe to re-run.
--
-- Auth tables ("user", "session", "account", "verification") are managed by
-- Better Auth; do not edit them here.
--
-- RLS is enabled on every app table with zero policies, which blocks the
-- anon/publishable key from reading or writing. All app access is through
-- Next.js API routes using the service role key.

create extension if not exists pgcrypto;

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

--------------------------------------------------------------------------------
-- profiles: one row per user, written at end of onboarding
--------------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id                 text primary key references public."user"(id) on delete cascade,
  goal                    text not null,
  archetype               text,
  mode_preferences        jsonb not null default '{}'::jsonb,
  constraints             jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

--------------------------------------------------------------------------------
-- quests: weekly assignments; status flows active -> completed|swapped|expired
--------------------------------------------------------------------------------
create table if not exists public.quests (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public."user"(id) on delete cascade,
  template_id text not null,
  title       text not null,
  description text,
  target      jsonb not null default '{}'::jsonb,
  progress    jsonb not null default '{}'::jsonb,
  status      text not null default 'active'
    check (status in ('active', 'completed', 'swapped', 'expired')),
  xp_reward   integer not null default 0,
  assigned_at timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists quests_user_status_idx on public.quests (user_id, status);
create index if not exists quests_expires_at_idx on public.quests (expires_at)
  where status = 'active';

drop trigger if exists quests_set_updated_at on public.quests;
create trigger quests_set_updated_at
before update on public.quests
for each row execute function public.set_updated_at();

--------------------------------------------------------------------------------
-- challenges: opt-in, time-boxed; same shape as quests plus duration fields
--------------------------------------------------------------------------------
create table if not exists public.challenges (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references public."user"(id) on delete cascade,
  template_id    text not null,
  title          text not null,
  description    text,
  target         jsonb not null default '{}'::jsonb,
  progress       jsonb not null default '{}'::jsonb,
  status         text not null default 'active'
    check (status in ('active', 'completed', 'swapped', 'expired')),
  xp_reward      integer not null default 0,
  joined_at      timestamptz not null default now(),
  duration_days  integer not null,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists challenges_user_status_idx on public.challenges (user_id, status);

drop trigger if exists challenges_set_updated_at on public.challenges;
create trigger challenges_set_updated_at
before update on public.challenges
for each row execute function public.set_updated_at();

--------------------------------------------------------------------------------
-- quest_events: append-only log of check-ins and state transitions
-- event_type: done | skipped | later | assigned | swapped | expired | completed
--------------------------------------------------------------------------------
create table if not exists public.quest_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public."user"(id) on delete cascade,
  quest_id   uuid references public.quests(id) on delete cascade,
  event_type text not null
    check (event_type in ('done', 'skipped', 'later', 'assigned', 'swapped', 'expired', 'completed')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quest_events_user_created_idx
  on public.quest_events (user_id, created_at desc);
create index if not exists quest_events_quest_idx
  on public.quest_events (quest_id);

--------------------------------------------------------------------------------
-- user_badges: earned badges (badge catalog lives in app code)
--------------------------------------------------------------------------------
create table if not exists public.user_badges (
  user_id   text not null references public."user"(id) on delete cascade,
  badge_id  text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

--------------------------------------------------------------------------------
-- unlocks: cosmetic items owned (catalog in app code)
--------------------------------------------------------------------------------
create table if not exists public.unlocks (
  user_id     text not null references public."user"(id) on delete cascade,
  item_id     text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

--------------------------------------------------------------------------------
-- xp_ledger: append-only; current XP = sum(delta) per user
--------------------------------------------------------------------------------
create table if not exists public.xp_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public."user"(id) on delete cascade,
  delta      integer not null,
  reason     text not null,
  quest_id   uuid references public.quests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists xp_ledger_user_created_idx
  on public.xp_ledger (user_id, created_at desc);

--------------------------------------------------------------------------------
-- whatsapp_messages: inbound/outbound log; ~30d retention policy (not enforced)
--------------------------------------------------------------------------------
create table if not exists public.whatsapp_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    text references public."user"(id) on delete cascade,
  direction  text not null check (direction in ('inbound', 'outbound')),
  body       text not null,
  twilio_sid text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_user_created_idx
  on public.whatsapp_messages (user_id, created_at desc);
create index if not exists whatsapp_messages_created_idx
  on public.whatsapp_messages (created_at desc);

--------------------------------------------------------------------------------
-- Lock down anon/publishable-key access. App writes go through the service role
-- from Next.js API routes.
--------------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.quests             enable row level security;
alter table public.challenges         enable row level security;
alter table public.quest_events       enable row level security;
alter table public.user_badges        enable row level security;
alter table public.unlocks            enable row level security;
alter table public.xp_ledger          enable row level security;
alter table public.whatsapp_messages  enable row level security;
