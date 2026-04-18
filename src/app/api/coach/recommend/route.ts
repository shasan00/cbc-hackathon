import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchUpcomingEvents } from "@/lib/google-calendar";
import { searchNearby } from "@/lib/places";
import type { Archetype } from "@/lib/profile";
import { buildUserMessage, COACH_SYSTEM, type CoachContext } from "@/lib/coach";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    time_hint?: "right_now" | "next_event";
  };
  const timeHint = body.time_hint === "right_now" ? "right_now" : "next_event";

  const { data: profile, error: pErr } = await getSupabaseAdmin()
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr)
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json(
      { error: "onboarding not complete" },
      { status: 400 },
    );
  }

  let upcoming: Array<{
    summary: string;
    start: string;
    end: string;
    location?: string;
    allDay: boolean;
  }> = [];
  try {
    const events = await fetchUpcomingEvents(userId, { days: 7, maxResults: 10 });
    upcoming = events;
  } catch (e) {
    console.error("calendar fetch failed:", e);
  }

  const now = Date.now();
  const futureEvents = upcoming.filter(
    (e) => new Date(e.end).getTime() >= now,
  );
  const next = futureEvents[0];

  const archetype = (profile.archetype ?? "mixed") as Archetype;

  let nearbyPlaces: CoachContext["nearby_places"] = undefined;
  if (timeHint === "next_event" && next?.location) {
    try {
      const places = await searchNearby(next.location, archetype, 5);
      nearbyPlaces = places.map((p) => ({
        name: p.name,
        category: p.category,
        address: p.address,
        rating: p.rating,
        price_level: p.price_level,
      }));
    } catch (e) {
      console.error("places lookup failed:", e);
    }
  }

  const ctx: CoachContext = {
    character_name: profile.mode_preferences?.character_name,
    archetype,
    goal: profile.goal,
    non_negotiables: profile.constraints?.non_negotiables || undefined,
    mode_preferences: profile.mode_preferences,
    next_event: next
      ? {
          summary: next.summary,
          start: next.start,
          end: next.end,
          location: next.location,
          all_day: next.allDay,
          minutes_until: Math.max(
            0,
            Math.round((new Date(next.start).getTime() - now) / 60000),
          ),
        }
      : null,
    upcoming_events: futureEvents.slice(0, 4).map((e) => ({
      summary: e.summary,
      start: e.start,
      location: e.location,
    })),
    nearby_places: nearbyPlaces,
    now_local: new Date().toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }),
    time_hint: timeHint,
  };

  const userMessage = buildUserMessage(ctx);

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: COACH_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      try {
        stream.on("text", (delta) => {
          controller.enqueue(
            encoder.encode(
              `event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`,
            ),
          );
        });
        const finalMessage = await stream.finalMessage();
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              usage: finalMessage.usage,
              stop_reason: finalMessage.stop_reason,
            })}\n\n`,
          ),
        );
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown error";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
