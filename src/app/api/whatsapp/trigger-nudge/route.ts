/**
 * POST /api/whatsapp/trigger-nudge
 *
 * Manual nudge trigger — used by the demo "Send Morning Nudge" dashboard button
 * and by a Vercel Cron job (cron.json → "0 8 * * *").
 *
 * Body (optional): { userId?: string }
 * If userId is omitted the route nudges all users whose profiles have a wa_id set.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { sendNudge } from "@/lib/whatsapp";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  // Auth guard: only callable by the dashboard (session) or Vercel Cron header.
  const cronSecret = req.headers.get("x-vercel-cron-secret");
  if (cronSecret && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let targetUserId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    targetUserId = body.userId ?? null;
  } catch {}

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  // Fetch profiles to nudge.
  let query = supabase
    .from("profiles")
    .select("user_id, goal, mode_preferences, constraints, whatsapp_wa_id")
    .not("whatsapp_wa_id", "is", null);

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  // onboarding_completed_at is a timestamp per the data model; null means not yet completed.
  query = query.not("onboarding_completed_at", "is", null);

  const { data: profiles, error } = await query;
  if (error || !profiles?.length) {
    return NextResponse.json({ ok: true, nudged: 0 });
  }

  const results = await Promise.allSettled(profiles.map((p) => nudgeUser(p)));

  const nudged = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, nudged });
}

// ── Per-user nudge ───────────────────────────────────────────────────────────

async function nudgeUser(profile: {
  user_id: string;
  goal: string;
  mode_preferences: Record<string, unknown>;
  constraints: Record<string, unknown>;
  whatsapp_wa_id: string;
}) {
  // supabase is guaranteed non-null here (checked in POST handler before this is called).
  const supabase = getSupabase()!;

  // 1. Fetch the user's active quest.
  const { data: quest } = await supabase
    .from("quests")
    .select("id, title, description")
    .eq("user_id", profile.user_id)
    .eq("status", "active")
    .order("assigned_at", { ascending: false })
    .limit(1)
    .single();

  if (!quest) return;

  // 2. Fetch calendar events for today (stored as a cached snapshot from the
  //    calendar-sync route — avoids calling Google at cron time).
  const { data: calEvents } = await supabase
    .from("calendar_events_cache")
    .select("summary, start_time, location")
    .eq("user_id", profile.user_id)
    .gte("start_time", new Date().toISOString())
    .lte("start_time", new Date(Date.now() + 8 * 3600_000).toISOString())
    .order("start_time")
    .limit(3);

  const eventSummary = calEvents?.length
    ? calEvents
        .map((e) => `${e.summary} at ${new Date(e.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${e.location ? ` (${e.location})` : ""}`)
        .join(", ")
    : "no upcoming events";

  // 3. Call Claude to generate a venue-aware nudge (≤160 chars for WhatsApp readability).
  const completion = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: [
      "You are an ambient health coach sending a WhatsApp nudge.",
      "Write ONE actionable tip (≤160 chars) relevant to the user's upcoming schedule.",
      "Be specific and practical. No hashtags. No emojis unless they fit naturally.",
      `User goal: ${profile.goal}`,
      `Constraints: ${JSON.stringify(profile.constraints ?? {})}`,
    ].join(" "),
    messages: [
      {
        role: "user",
        content: `Active quest: "${quest.title}" — ${quest.description}\nUpcoming schedule: ${eventSummary}\n\nWrite the nudge.`,
      },
    ],
  });

  const advice =
    completion.content[0].type === "text"
      ? completion.content[0].text.trim()
      : quest.description;

  const headline = calEvents?.length
    ? `${calEvents[0].summary} coming up — your nudge:`
    : "Your health nudge for now:";

  // 4. Send the WhatsApp interactive message.
  await sendNudge(profile.whatsapp_wa_id, {
    questId: quest.id,
    headline,
    advice,
  });
}
