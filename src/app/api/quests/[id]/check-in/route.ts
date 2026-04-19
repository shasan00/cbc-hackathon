import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

type EventType = "done" | "later" | "skipped";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    event_type?: EventType;
  };
  const ev = body.event_type;
  if (ev !== "done" && ev !== "later" && ev !== "skipped") {
    return NextResponse.json({ error: "invalid event_type" }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  const { data: quest, error: qErr } = await db
    .from("quests")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!quest)
    return NextResponse.json({ error: "quest not found" }, { status: 404 });

  if (quest.status !== "active") {
    return NextResponse.json({ quest, xpDelta: 0 });
  }

  let xpDelta = 0;

  if (ev === "done") {
    const target = (quest.target?.count as number | undefined) ?? 1;
    const nextCount = Math.min(target, (quest.progress?.count ?? 0) + 1);
    const completing = nextCount >= target;

    const { data: updated, error: uErr } = await db
      .from("quests")
      .update({
        progress: { ...(quest.progress ?? {}), count: nextCount },
        status: completing ? "completed" : "active",
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (uErr)
      return NextResponse.json({ error: uErr.message }, { status: 500 });

    await db.from("quest_events").insert({
      user_id: userId,
      quest_id: id,
      event_type: completing ? "completed" : "done",
      payload: { count: nextCount },
    });

    if (completing) {
      xpDelta = quest.xp_reward ?? 0;
      await db.from("xp_ledger").insert({
        user_id: userId,
        delta: xpDelta,
        reason: `quest:${quest.template_id}`,
        quest_id: id,
      });
    }

    return NextResponse.json({ quest: updated, xpDelta });
  }

  if (ev === "later") {
    await db.from("quest_events").insert({
      user_id: userId,
      quest_id: id,
      event_type: "later",
      payload: {},
    });
    return NextResponse.json({ quest, xpDelta: 0 });
  }

  // skipped → mark expired
  const { data: updated, error: uErr } = await db
    .from("quests")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  await db.from("quest_events").insert({
    user_id: userId,
    quest_id: id,
    event_type: "skipped",
    payload: {},
  });

  return NextResponse.json({ quest: updated, xpDelta: 0 });
}
