"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import {
  archetypeTitle,
  type Archetype,
  type Appearance,
} from "@/lib/profile";
import {
  DEFAULT_APPEARANCE,
  PortraitFrame,
  Sprite,
} from "@/components/sprite";

type Profile = {
  goal: string;
  archetype: Archetype | null;
  mode_preferences: {
    predictability?: string;
    meal_venue?: string;
    travel_frequency?: string;
    cook_frequency?: string;
    budget?: string;
    dining_hall_type?: string;
    character_name?: string;
    appearance?: Appearance;
  };
  constraints: { non_negotiables?: string };
  onboarding_completed_at: string | null;
};

type CalEvent = {
  id: string;
  summary: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
};

type CalState =
  | { status: "loading" }
  | { status: "ok"; events: CalEvent[] }
  | { status: "error"; message: string };

type Quest = {
  id: string;
  template_id: string;
  title: string;
  description: string;
  target: { count: number; unit: string };
  progress: { count: number };
  status: "active" | "completed" | "expired" | "swapped";
  xp_reward: number;
};

type QuestState =
  | { status: "loading" }
  | { status: "ok"; quests: Quest[]; xp: number }
  | { status: "error"; message: string };

function toneFromTemplateId(
  id: string,
): "water" | "veg" | "move" | "sleep" {
  if (id.startsWith("hydra")) return "water";
  if (id.startsWith("green")) return "veg";
  if (id.startsWith("lights")) return "sleep";
  return "move";
}

const SUBCLASS: Record<Archetype, string> = {
  traveler: "Red-eye Regular",
  home_based: "Kitchen Sage",
  institutional: "Cafeteria Veteran",
  mixed: "Jack-of-Plates",
};

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cal, setCal] = useState<CalState>({ status: "loading" });
  const [qs, setQs] = useState<QuestState>({ status: "loading" });
  const [sage, setSage] = useState<{
    status: "idle" | "streaming" | "done" | "error";
    text: string;
    error?: string;
    hint: "next_event" | "right_now";
  }>({ status: "idle", text: "", hint: "next_event" });
  const sageAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.profile?.onboarding_completed_at) {
          router.replace("/onboarding");
          return;
        }
        setProfile(d.profile);
      })
      .finally(() => setLoading(false));
  }, [session, router]);

  useEffect(() => {
    if (!session?.user) return;
    if (!profile?.onboarding_completed_at) return;
    fetch("/api/quests")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "quests error");
        setQs({ status: "ok", quests: d.quests ?? [], xp: d.xp ?? 0 });
      })
      .catch((e: Error) =>
        setQs({ status: "error", message: e.message }),
      );
  }, [session, profile]);

  async function checkIn(
    questId: string,
    eventType: "done" | "later" | "skipped",
  ) {
    if (qs.status !== "ok") return;
    // optimistic update
    const prev = qs;
    const optimistic = qs.quests.map((q) => {
      if (q.id !== questId) return q;
      if (eventType === "done") {
        const nextCount = Math.min(
          q.target.count,
          (q.progress?.count ?? 0) + 1,
        );
        const completing = nextCount >= q.target.count;
        return {
          ...q,
          progress: { ...q.progress, count: nextCount },
          status: completing ? ("completed" as const) : q.status,
        };
      }
      if (eventType === "skipped") return { ...q, status: "expired" as const };
      return q;
    });
    const optimisticXp =
      eventType === "done"
        ? (() => {
            const q = qs.quests.find((x) => x.id === questId);
            if (!q) return qs.xp;
            const next = Math.min(q.target.count, (q.progress?.count ?? 0) + 1);
            return next >= q.target.count ? qs.xp + (q.xp_reward ?? 0) : qs.xp;
          })()
        : qs.xp;
    setQs({ status: "ok", quests: optimistic, xp: optimisticXp });

    try {
      const res = await fetch(`/api/quests/${questId}/check-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_type: eventType }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "check-in failed");
      // reconcile from server
      const merged = optimistic.map((q) =>
        q.id === questId ? (d.quest as Quest) : q,
      );
      setQs({
        status: "ok",
        quests: merged,
        xp: qs.xp + (d.xpDelta ?? 0),
      });
    } catch (e) {
      setQs(prev);
      console.error("check-in failed:", e);
    }
  }

  const callSage = useCallback(
    async (hint: "next_event" | "right_now") => {
      sageAbortRef.current?.abort();
      const controller = new AbortController();
      sageAbortRef.current = controller;
      setSage({ status: "streaming", text: "", hint });
      try {
        const res = await fetch("/api/coach/recommend", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ time_hint: hint }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          setSage({
            status: "error",
            text: "",
            hint,
            error: d.error ?? `HTTP ${res.status}`,
          });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const lines = part.split("\n");
            const evLine = lines.find((l) => l.startsWith("event: "));
            const dataLine = lines.find((l) => l.startsWith("data: "));
            if (!evLine || !dataLine) continue;
            const evType = evLine.slice(7).trim();
            const data = JSON.parse(dataLine.slice(6));
            if (evType === "delta") {
              acc += data.text;
              setSage((s) => ({ ...s, status: "streaming", text: acc }));
            } else if (evType === "done") {
              setSage((s) => ({ ...s, status: "done", text: acc }));
            } else if (evType === "error") {
              setSage((s) => ({
                ...s,
                status: "error",
                error: data.error,
              }));
            }
          }
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        const msg = e instanceof Error ? e.message : "stream failed";
        setSage({ status: "error", text: "", hint, error: msg });
      }
    },
    [],
  );

  useEffect(() => {
    if (!session?.user) return;
    if (!profile?.onboarding_completed_at) return;
    if (cal.status === "loading") return;
    callSage("next_event");
    return () => sageAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.onboarding_completed_at, cal.status]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/calendar/upcoming")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "calendar error");
        setCal({ status: "ok", events: d.events ?? [] });
      })
      .catch((e: Error) =>
        setCal({ status: "error", message: e.message }),
      );
  }, [session]);

  if (isPending || loading || !profile) return null;

  const archetype = profile.archetype ?? "mixed";
  const appearance = profile.mode_preferences.appearance ?? DEFAULT_APPEARANCE;
  const name =
    (profile.mode_preferences.character_name || "ADVENTURER").toUpperCase();
  const venueLabel = venueHuman(profile.mode_preferences.meal_venue);

  const events = cal.status === "ok" ? cal.events : [];
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.end).getTime() >= now);
  const nextEvent = upcoming[0];
  const eventsToday = upcoming.filter((e) => isToday(e.start));
  const groupedEvents = groupByDay(upcoming.slice(0, 8));

  return (
    <main className="min-h-screen pb-10">
      {/* HUD */}
      <header
        className="mx-5 mt-5 grid items-center gap-3 border-[3px] border-ink bg-gb-darkest px-4 py-2 font-press text-[10px] text-gb-pale scanlines"
        style={{
          boxShadow: "4px 4px 0 var(--ink)",
          gridTemplateColumns: "auto 1fr auto auto auto auto",
        }}
      >
        <span className="flex items-center gap-2">
          <PixelLogo />
          <span className="text-gold">MEAL&nbsp;QUEST</span>
        </span>
        <span>
          <span className="text-gb-light">DAY </span>
          <span className="text-white">{dayNo(profile.onboarding_completed_at)}</span>
          &nbsp;&nbsp;<span className="text-gb-mid">/</span>&nbsp;&nbsp;
          <span className="text-gb-light">ZONE </span>
          <span className="text-white">
            {nextEvent?.location
              ? shortLocation(nextEvent.location)
              : venueLabel}
          </span>
        </span>
        <span>
          <span className="text-berry">♥♥♥</span>
          <span className="text-gb-mid">♡♡</span>
        </span>
        <span>
          <span className="text-gb-light">XP </span>
          <span className="text-white">
            {qs.status === "ok" ? qs.xp : "—"}
          </span>
        </span>
        <span>
          <span className="text-gb-light">GOLD </span>
          <span className="text-gold">★ 12</span>
        </span>
        <button
          onClick={() => signOut()}
          className="font-press text-[9px] text-rose hover:text-white"
        >
          SIGN&nbsp;OUT
        </button>
      </header>

      <div className="mx-5 mt-5 grid gap-5 lg:grid-cols-[300px_1fr_320px]">
        {/* LEFT — character */}
        <aside className="flex flex-col gap-5">
          <div className="pixel-frame">
            <span
              className="font-press absolute -top-[12px] left-[12px] border-[3px] border-ink bg-gb-darkest px-2 py-[3px] text-[8px] text-gold"
            >
              ★ PARTY
            </span>
            <PortraitFrame className="h-[200px]">
              <div className="anim-bob absolute bottom-[18px] left-1/2 -translate-x-1/2">
                <Sprite archetype={archetype} appearance={appearance} size={112} />
              </div>
            </PortraitFrame>

            <div className="mt-3 flex items-center gap-3 border-t-[3px] border-dashed border-ink-soft pt-3">
              <span
                className="font-press border-[3px] border-ink bg-ink px-2 py-[4px] text-[9px] text-gold"
                style={{ boxShadow: "3px 3px 0 var(--shadow)" }}
              >
                LV&nbsp;1
              </span>
              <div>
                <div className="font-press text-[11px] text-ink">
                  {name}
                </div>
                <div className="font-silk text-[12px] text-ink-soft">
                  Class: {archetypeTitle(archetype).replace("The ", "")} · Sub:{" "}
                  {SUBCLASS[archetype]}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <StatRow k="HP" v="9 / 9" pct={100} kind="hp" />
              <StatRow k="HYDRO" v="3 / 6" pct={50} kind="hydro" />
              <StatRow k="FUEL" v="2 / 5" pct={40} kind="fuel" />
              <StatRow k="XP" v="Lv 2 →" pct={18} kind="xp" />
            </div>
          </div>

          <div className="pixel-frame">
            <h3 className="font-press text-[9px] text-ink">
              ✦ EFFECTS
            </h3>
            <div className="mt-3 flex flex-col gap-2 font-silk text-[13px]">
              <EffectRow name="☀ EARLY BIRD" value="+10% XP" tone="green" />
              <EffectRow name="✈ JETLAG" value="−1 HP/hr" tone="berry" />
              <EffectRow name="♨ LAYOVER" value="FUEL choice" tone="sunset" />
            </div>
          </div>
        </aside>

        {/* MIDDLE — quest board */}
        <section className="flex flex-col">
          <div
            className="flex flex-wrap items-center gap-3 border-[3px] border-ink bg-gb-dark px-4 py-3 font-silk text-[12px] text-gb-pale"
            style={{ boxShadow: "4px 4px 0 var(--ink)" }}
          >
            <span
              className="font-press border-[2px] border-ink bg-gold px-2 py-[2px] text-[8px] text-ink"
            >
              TODAY
            </span>
            <span>
              {today()} — <b>{eventsToday.length} events</b> today · next:{" "}
              <b>
                {cal.status === "loading"
                  ? "syncing calendar…"
                  : cal.status === "error"
                  ? "calendar offline"
                  : nextEvent
                  ? `${formatEventTime(nextEvent)} ${shorten(nextEvent.summary, 42)}`
                  : "nothing in the next 7 days"}
              </b>
            </span>
            <span className="ml-auto text-gb-light">SAVE ●</span>
          </div>

          <ItineraryPanel cal={cal} grouped={groupedEvents} nextId={nextEvent?.id} />

          <h2 className="font-press mt-5 flex items-center gap-3 text-[14px] text-ink">
            <span
              className="inline-block h-[14px] w-[14px] border-[2px] border-ink bg-gb-dark"
              style={{ boxShadow: "3px 3px 0 var(--shadow)" }}
            />
            Active Quests
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {qs.status === "loading" && (
              <p className="font-silk text-[13px] text-ink-soft">
                Loading your quests…
              </p>
            )}
            {qs.status === "error" && (
              <p className="font-silk text-[13px] text-berry">
                ⚠ {qs.message}
              </p>
            )}
            {qs.status === "ok" &&
              qs.quests.map((q) => {
                const pct = Math.round(
                  (Math.min(q.progress?.count ?? 0, q.target.count) /
                    q.target.count) *
                    100,
                );
                const meta =
                  q.status === "completed"
                    ? "COMPLETE ✓"
                    : q.status === "expired"
                    ? "SKIPPED"
                    : `${q.progress?.count ?? 0} / ${q.target.count} ${q.target.unit}`;
                return (
                  <QuestCard
                    key={q.id}
                    tone={toneFromTemplateId(q.template_id)}
                    title={q.title}
                    sub={q.description}
                    pct={q.status === "completed" ? 100 : pct}
                    meta={meta}
                    xp={`+${q.xp_reward} XP`}
                    done={q.status !== "active"}
                    onDone={() => checkIn(q.id, "done")}
                    onLater={() => checkIn(q.id, "later")}
                    onSkip={() => checkIn(q.id, "skipped")}
                  />
                );
              })}
          </div>

          {/* NPC dialog */}
          <div
            className="relative mt-6 grid grid-cols-[72px_1fr] gap-4 overflow-hidden border-[3px] border-ink bg-gb-darkest p-4 text-gb-pale scanlines"
            style={{ boxShadow: "4px 4px 0 var(--ink)" }}
          >
            <div
              className="h-[72px] w-[72px] border-[3px] border-gb-light bg-gb-dark"
              style={{ display: "grid", placeItems: "center" }}
            >
              <CoachSprite />
            </div>
            <div>
              <div className="font-press text-[9px] text-gold">
                SAGE · your ambient coach
              </div>
              <p className="mt-2 font-pixel text-[15px] leading-[1.45] min-h-[3em]">
                {sage.status === "streaming" && sage.text === "" && (
                  <span className="text-gb-light">
                    Thinking about your next move
                    <span className="anim-blink">…</span>
                  </span>
                )}
                {sage.status === "streaming" && sage.text && (
                  <span>
                    {sage.text}
                    <span
                      className="anim-blink inline-block text-gold"
                      style={{ marginLeft: "2px" }}
                    >
                      ▎
                    </span>
                  </span>
                )}
                {sage.status === "done" && sage.text}
                {sage.status === "idle" &&
                  `Welcome, ${name}. Tap ⚡ CALL COACH for a live recommendation.`}
                {sage.status === "error" && (
                  <span className="text-rose">
                    Comms down: {sage.error ?? "unknown"}.
                  </span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => callSage("right_now")}
                  disabled={sage.status === "streaming"}
                  className="pixel-btn pixel-btn-gold"
                  style={{ fontSize: "8px", padding: "6px 10px" }}
                >
                  ⚡ CALL COACH (NOW)
                </button>
                <button
                  onClick={() => callSage("next_event")}
                  disabled={sage.status === "streaming"}
                  className="pixel-btn pixel-btn-later"
                  style={{ fontSize: "8px", padding: "6px 10px" }}
                >
                  ✦ NEXT EVENT
                </button>
              </div>
              <span className="anim-blink absolute right-[14px] bottom-[10px] text-gold">
                ▼
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT — rewards rail */}
        <aside className="flex flex-col gap-5">
          <div className="pixel-frame">
            <h3 className="font-press text-[10px]">✦ BADGE WALL</h3>
            <div className="mt-3 grid grid-cols-4 gap-[10px]">
              {["★", "♥", "♒", "✈", null, null, "☀", null, null, null, null, null].map(
                (b, i) => (
                  <Badge key={i} symbol={b} rare={i === 1} epic={i === 4} />
                ),
              )}
            </div>
            <p className="font-silk mt-3 text-[11px] text-ink-soft">
              4 / 12 collected · next:{" "}
              <b className="text-ink">SEVEN-DAY SAGE</b>
            </p>
          </div>

          <div className="pixel-frame-dark scanlines">
            <h3 className="font-press text-[10px] text-gold">
              ✦ COSMETIC LOCKER
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-[10px]">
              <Cosmetic label="Explorer Cap" tag="NEW!" kind="cap" isNew />
              <Cosmetic label="Canteen+" tag="EQUIPPED" kind="canteen" />
              <Cosmetic label="Forager Tunic" tag="OWNED" kind="tunic" />
              <Cosmetic label="Stormcloak" tag="500 XP LOCK" kind="locked" dim />
            </div>
          </div>

          <div className="pixel-frame">
            <h3 className="font-press text-[10px]">✦ CHALLENGE</h3>
            <p className="font-silk mt-2 text-[13px] text-ink">
              7-DAY HYDRATION RUN
            </p>
            <div className="stat-bar stat-bar-hydro mt-2" style={{ height: 14 }}>
              <i style={{ width: "57%" }} />
            </div>
            <p className="font-silk mt-2 text-[11px] text-ink-soft">
              Day 4 of 7 · reward:{" "}
              <b className="text-berry">Azure Canteen skin</b>
            </p>
          </div>
        </aside>
      </div>

      {/* Footer / legend */}
      <footer
        className="mx-5 mt-6 flex flex-wrap items-center justify-between gap-3 border-[3px] border-ink bg-paper px-4 py-3 font-silk text-[12px] text-ink-soft"
        style={{ boxShadow: "4px 4px 0 var(--ink)" }}
      >
        <span>
          Controls: <Kbd>↑↓</Kbd> nav · <Kbd>A</Kbd> check-in · <Kbd>B</Kbd> later ·{" "}
          <Kbd>START</Kbd> swap quest
        </span>
        <span>v0.1 · field guide · Not medical advice.</span>
      </footer>
    </main>
  );
}

/* ============================== PIECES ================================== */
function ItineraryPanel({
  cal,
  grouped,
  nextId,
}: {
  cal: CalState;
  grouped: { label: string; events: CalEvent[] }[];
  nextId?: string;
}) {
  return (
    <div
      className="mt-5 relative border-[3px] border-ink bg-cream p-4"
      style={{ boxShadow: "4px 4px 0 var(--ink)" }}
    >
      <span
        className="font-press absolute -top-[12px] left-[12px] border-[3px] border-ink bg-gb-darkest px-2 py-[3px] text-[8px] text-gold"
      >
        ✦ ITINERARY
      </span>
      {cal.status === "loading" && (
        <p className="font-silk text-[13px] text-ink-soft">
          Syncing with Google Calendar…
        </p>
      )}
      {cal.status === "error" && (
        <div className="font-silk text-[13px] text-berry">
          ⚠ Calendar offline: {cal.message}
        </div>
      )}
      {cal.status === "ok" && grouped.length === 0 && (
        <p className="font-silk text-[13px] text-ink-soft">
          No events in the next 7 days.
        </p>
      )}
      {cal.status === "ok" && grouped.length > 0 && (
        <div className="flex flex-col gap-4">
          {grouped.map((g) => (
            <div key={g.label}>
              <div className="font-press mb-2 text-[9px] text-ink-soft">
                {g.label}
              </div>
              <div className="flex flex-col gap-[6px]">
                {g.events.map((e) => (
                  <EventRow key={e.id} event={e} isNext={e.id === nextId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating?: number;
  price_level?: string;
  map_url?: string;
};

type NearbyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; places: NearbyPlace[] }
  | { status: "error"; message: string };

function EventRow({ event, isNext }: { event: CalEvent; isNext: boolean }) {
  const [open, setOpen] = useState(false);
  const [nearby, setNearby] = useState<NearbyState>({ status: "idle" });

  async function toggle() {
    if (!event.location) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (nearby.status === "ok" || nearby.status === "loading") return;
    setNearby({ status: "loading" });
    try {
      const res = await fetch(
        `/api/places/nearby?location=${encodeURIComponent(event.location)}`,
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setNearby({ status: "ok", places: d.places ?? [] });
    } catch (e) {
      setNearby({
        status: "error",
        message: e instanceof Error ? e.message : "failed",
      });
    }
  }

  return (
    <div>
      <div
        className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-3 border-[2px] border-ink px-3 py-2"
        style={{
          background: isNext ? "var(--gold)" : "var(--paper)",
          boxShadow: isNext ? "3px 3px 0 var(--ink)" : "2px 2px 0 var(--shadow)",
        }}
      >
        <span className="font-press text-[9px] text-ink">
          {event.allDay ? "ALL DAY" : formatEventTime(event)}
        </span>
        <span className="font-pixel truncate text-[14px] text-ink">
          {event.summary}
        </span>
        <span className="font-silk max-w-[140px] truncate text-right text-[11px] text-ink-soft">
          {event.location ? shortLocation(event.location) : "—"}
        </span>
        {event.location ? (
          <button
            onClick={toggle}
            className="font-press border-[2px] border-ink bg-sky px-2 py-[4px] text-[8px] text-white"
            style={{ boxShadow: "2px 2px 0 var(--ink)" }}
            aria-expanded={open}
          >
            {open ? "×" : "📍"}
          </button>
        ) : (
          <span />
        )}
      </div>
      {open && event.location && (
        <div
          className="mt-[6px] border-[2px] border-ink bg-gb-pale px-3 py-2"
          style={{ boxShadow: "2px 2px 0 var(--shadow)" }}
        >
          <div className="font-press mb-2 text-[8px] text-gb-dark">
            ✦ NEARBY @ {shortLocation(event.location).toUpperCase()}
          </div>
          {nearby.status === "loading" && (
            <p className="font-silk text-[12px] text-ink-soft">Scouting…</p>
          )}
          {nearby.status === "error" && (
            <p className="font-silk text-[12px] text-berry">
              ⚠ {nearby.message}
            </p>
          )}
          {nearby.status === "ok" && nearby.places.length === 0 && (
            <p className="font-silk text-[12px] text-ink-soft">
              No venues found.
            </p>
          )}
          {nearby.status === "ok" && nearby.places.length > 0 && (
            <ul className="flex flex-col gap-[4px]">
              {nearby.places.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] gap-2 border-b border-dashed border-ink-soft py-1 last:border-none"
                >
                  <div className="min-w-0">
                    <div className="font-pixel truncate text-[13px] text-ink">
                      {p.map_url ? (
                        <a
                          href={p.map_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-dashed underline-offset-2"
                        >
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                    </div>
                    <div className="font-silk truncate text-[11px] text-ink-soft">
                      {p.category}
                    </div>
                  </div>
                  <div className="font-silk whitespace-nowrap text-right text-[11px] text-ink-soft">
                    {p.price_level ?? ""}
                    {p.price_level && p.rating ? " · " : ""}
                    {p.rating ? `★${p.rating.toFixed(1)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StatRow({
  k,
  v,
  pct,
  kind,
}: {
  k: string;
  v: string;
  pct: number;
  kind: "hp" | "hydro" | "fuel" | "xp";
}) {
  return (
    <div className="grid grid-cols-[64px_1fr_64px] items-center gap-2 font-silk text-[12px]">
      <span className="text-ink-soft uppercase">{k}</span>
      <span className={`stat-bar stat-bar-${kind}`}>
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right font-bold text-ink">{v}</span>
    </div>
  );
}

function EffectRow({
  name,
  value,
  tone,
}: {
  name: string;
  value: string;
  tone: "green" | "berry" | "sunset";
}) {
  const color =
    tone === "berry"
      ? "var(--berry)"
      : tone === "sunset"
      ? "var(--sunset)"
      : "var(--gb-mid)";
  return (
    <div className="flex justify-between">
      <span>{name}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function QuestCard({
  tone,
  title,
  sub,
  pct,
  meta,
  xp,
  done,
  onDone,
  onLater,
  onSkip,
}: {
  tone: "water" | "veg" | "move" | "sleep";
  title: string;
  sub: string;
  pct: number;
  meta: string;
  xp: string;
  done?: boolean;
  onDone?: () => void;
  onLater?: () => void;
  onSkip?: () => void;
}) {
  const iconBg =
    tone === "water"
      ? "var(--sky)"
      : tone === "veg"
      ? "var(--gb-light)"
      : tone === "move"
      ? "var(--sunset)"
      : "#c7b3e0";
  const fillBg =
    tone === "water"
      ? "var(--sky)"
      : tone === "veg"
      ? "var(--gb-mid)"
      : tone === "move"
      ? "var(--sunset)"
      : "#9a7dc2";
  const icon = tone === "water" ? "♒" : tone === "veg" ? "♣" : tone === "move" ? "➤" : "☾";

  return (
    <article
      className="relative border-[3px] border-ink bg-cream p-[14px] pl-[58px] transition-all hover:-translate-x-[2px] hover:-translate-y-[2px]"
      style={{ boxShadow: "4px 4px 0 var(--ink)" }}
    >
      <div
        className="font-press absolute -left-[14px] top-[14px] grid h-[44px] w-[44px] place-items-center border-[3px] border-ink text-[14px] text-ink"
        style={{ background: iconBg, boxShadow: "3px 3px 0 var(--shadow)" }}
      >
        {icon}
      </div>
      <div className="font-press text-[10px] text-ink">
        {title}
      </div>
      <div className="font-pixel mt-1 text-[14px] text-ink-soft">
        {sub}
      </div>
      <div
        className="mt-[6px] h-[10px] border-[2px] border-ink bg-paper-dark"
      >
        <div style={{ width: `${pct}%`, height: "100%", background: fillBg }} />
      </div>
      <div className="mt-[10px] flex items-center justify-between font-silk text-[11px] text-ink-soft">
        <span style={done ? { color: "var(--gb-mid)", fontWeight: 700 } : undefined}>
          {meta}
        </span>
        <span className="font-bold text-sunset">{xp}</span>
      </div>
      <div className="mt-[10px] flex gap-[6px]">
        {done ? (
          <button className="pixel-btn" disabled style={{ fontSize: 8, padding: "6px 8px" }}>
            CLAIMED
          </button>
        ) : (
          <>
            <button
              onClick={onDone}
              className="pixel-btn pixel-btn-go"
              style={{ fontSize: 8, padding: "6px 8px" }}
            >
              ✓ DONE
            </button>
            <button
              onClick={onLater}
              className="pixel-btn pixel-btn-later"
              style={{ fontSize: 8, padding: "6px 8px" }}
            >
              ⟲ LATER
            </button>
            <button
              onClick={onSkip}
              className="pixel-btn pixel-btn-skip"
              style={{ fontSize: 8, padding: "6px 8px" }}
            >
              ✕ SKIP
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Badge({
  symbol,
  rare,
  epic,
}: {
  symbol: string | null;
  rare?: boolean;
  epic?: boolean;
}) {
  const earned = symbol !== null;
  const bg = epic
    ? "var(--sky)"
    : rare
    ? "var(--berry)"
    : earned
    ? "var(--gold)"
    : undefined;
  const color = epic || rare ? "#fff" : "var(--ink)";
  return (
    <div
      className="font-press relative grid aspect-square place-items-center border-[3px] border-ink text-[14px]"
      style={{
        background: earned
          ? bg
          : "repeating-linear-gradient(45deg, var(--paper) 0 6px, var(--paper-dark) 6px 12px)",
        color,
        boxShadow: "3px 3px 0 var(--shadow)",
      }}
    >
      {earned ? (
        symbol
      ) : (
        <span className="text-shadow">?</span>
      )}
    </div>
  );
}

function Cosmetic({
  label,
  tag,
  kind,
  isNew,
  dim,
}: {
  label: string;
  tag: string;
  kind: "cap" | "canteen" | "tunic" | "locked";
  isNew?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-[6px] border-[3px] border-ink bg-cream p-2"
      style={{ boxShadow: "3px 3px 0 var(--shadow)", opacity: dim ? 0.45 : 1 }}
    >
      <div className="grid aspect-square w-full place-items-center border-[2px] border-ink bg-gb-pale">
        {kind === "cap" && <CapIcon />}
        {kind === "canteen" && <CanteenIcon />}
        {kind === "tunic" && <TunicIcon />}
        {kind === "locked" && <LockedIcon />}
      </div>
      <div className="font-silk text-center text-[11px] text-ink">
        {label}
      </div>
      <div
        className="font-press text-[7px]"
        style={{ color: isNew ? "var(--berry)" : "var(--ink-soft)" }}
      >
        {tag}
      </div>
    </div>
  );
}

function CapIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 11 11" shapeRendering="crispEdges">
      <rect x="3" y="2" width="5" height="1" fill="#b84a5e" />
      <rect x="2" y="3" width="7" height="3" fill="#c65d5d" />
      <rect x="1" y="6" width="9" height="1" fill="#2b2316" />
      <rect x="5" y="1" width="1" height="1" fill="#e6b94a" />
    </svg>
  );
}
function CanteenIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 11 11" shapeRendering="crispEdges">
      <rect x="2" y="2" width="7" height="7" fill="#6ba4c9" />
      <rect x="2" y="2" width="7" height="1" fill="#a5cde4" />
      <rect x="4" y="5" width="3" height="3" fill="#dfe9ba" />
    </svg>
  );
}
function TunicIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 11 11" shapeRendering="crispEdges">
      <rect x="2" y="3" width="7" height="5" fill="#2d5039" />
      <rect x="2" y="3" width="7" height="1" fill="#5f8c4b" />
      <rect x="4" y="5" width="3" height="1" fill="#e6b94a" />
    </svg>
  );
}
function LockedIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 11 11" shapeRendering="crispEdges">
      <rect x="3" y="2" width="5" height="7" fill="#8b7c5d" />
      <rect x="4" y="4" width="3" height="3" fill="#2b2316" />
    </svg>
  );
}

function CoachSprite() {
  return (
    <svg width="56" height="56" viewBox="0 0 14 14" shapeRendering="crispEdges">
      <rect x="3" y="1" width="8" height="2" fill="#e6b94a" />
      <rect x="2" y="2" width="10" height="3" fill="#f5ecd0" />
      <rect x="4" y="4" width="1" height="1" fill="#2b2316" />
      <rect x="9" y="4" width="1" height="1" fill="#2b2316" />
      <rect x="6" y="6" width="2" height="1" fill="#c65d5d" />
      <rect x="2" y="6" width="10" height="5" fill="#2d5039" />
      <rect x="2" y="6" width="10" height="1" fill="#5f8c4b" />
      <rect x="6" y="8" width="2" height="2" fill="#e6b94a" />
      <rect x="2" y="11" width="10" height="2" fill="#1a2f22" />
    </svg>
  );
}

function PixelLogo() {
  return (
    <span
      className="inline-block h-[20px] w-[20px] border-2 border-ink"
      style={{
        background:
          "linear-gradient(var(--gb-light),var(--gb-light)) 0 0/4px 4px, var(--gb-mid)",
        imageRendering: "pixelated",
      }}
    />
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="font-press mx-[2px] inline-block border-2 border-ink bg-ink px-[6px] py-[3px] text-[8px] text-cream"
      style={{ boxShadow: "2px 2px 0 var(--shadow)" }}
    >
      {children}
    </kbd>
  );
}

function dayNo(iso: string | null) {
  if (!iso) return "001";
  const days = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) + 1,
  );
  return days.toString().padStart(3, "0");
}

function today() {
  return new Date()
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}

function venueHuman(v?: string) {
  switch (v) {
    case "on_the_go": return "ON THE ROAD";
    case "home": return "HOME BASE";
    case "institutional": return "DINING HALL";
    case "mix": return "MIXED ZONE";
    default: return "—";
  }
}

function defaultVegQuest(a: Archetype) {
  switch (a) {
    case "traveler":
      return "Veg-forward meal at a terminal eatery — try Field Fare.";
    case "home_based":
      return "Cook one veg-forward dinner this week with what's in the fridge.";
    case "institutional":
      return "Fill half your tray with greens at the salad bar today.";
    case "mixed":
      return "One veg-forward meal this week, wherever you are.";
  }
}

function shortenGoal(g: string) {
  const s = g.trim();
  if (s.length <= 90) return s;
  return s.slice(0, 87).trim() + "…";
}

function shorten(s: string, n: number) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1).trim() + "…";
}

function shortLocation(loc: string) {
  const first = loc.split(",")[0]?.trim() ?? loc;
  return shorten(first, 28);
}

function isToday(iso: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(d: Date) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return "TODAY";
  if (sameDay(d, tomorrow)) return "TOMORROW";
  return d
    .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
}

function groupByDay(events: CalEvent[]) {
  const groups: { label: string; events: CalEvent[] }[] = [];
  let currentKey = "";
  for (const e of events) {
    const d = new Date(e.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== currentKey) {
      groups.push({ label: dayLabel(d), events: [] });
      currentKey = key;
    }
    groups[groups.length - 1].events.push(e);
  }
  return groups;
}

function formatEventTime(e: CalEvent) {
  if (e.allDay) return "ALL DAY";
  return new Date(e.start)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(" ", "");
}

function relativeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "now";
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr`;
  const d = Math.round(hr / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}
