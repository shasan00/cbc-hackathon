import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { templatesFor, weekEndIso } from "@/lib/quests";
import type { Archetype } from "@/lib/profile";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const db = getSupabaseAdmin();

  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("archetype")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ quests: [], xp: 0 });

  const archetype = (profile.archetype ?? "mixed") as Archetype;

  let { data: quests, error } = await db
    .from("quests")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "completed", "expired"])
    .order("assigned_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hasActive = (quests ?? []).some((q) => q.status === "active");
  if (!hasActive) {
    const templates = templatesFor(archetype);
    const expiresAt = weekEndIso();
    const rows = templates.map((t) => ({
      user_id: userId,
      template_id: t.template_id,
      title: t.title,
      description: t.description,
      target: t.target,
      progress: { count: 0 },
      status: "active",
      xp_reward: t.xp_reward,
      expires_at: expiresAt,
    }));
    const { data: inserted, error: insErr } = await db
      .from("quests")
      .insert(rows)
      .select();
    if (insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 });

    const events = (inserted ?? []).map((q) => ({
      user_id: userId,
      quest_id: q.id,
      event_type: "assigned",
      payload: {},
    }));
    if (events.length) await db.from("quest_events").insert(events);

    quests = [...(quests ?? []), ...(inserted ?? [])];
  }

  const { data: xpRows } = await db
    .from("xp_ledger")
    .select("delta")
    .eq("user_id", userId);
  const xp = (xpRows ?? []).reduce(
    (sum: number, r: { delta: number }) => sum + r.delta,
    0,
  );

  return NextResponse.json({ quests: quests ?? [], xp });
}
