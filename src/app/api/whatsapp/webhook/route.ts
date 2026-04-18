import { NextRequest, NextResponse } from "next/server";
import { parseWebhookMessage, sendText, WaMessage } from "@/lib/whatsapp";
import { getSupabase } from "@/lib/supabase";

// ── GET: Kapso webhook verification handshake ────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: Inbound messages + quick-reply button taps ────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const msg = parseWebhookMessage(body);
  if (!msg) {
    // Not a message event (e.g. delivery status) — ack and move on.
    return NextResponse.json({ ok: true });
  }

  if (msg.type === "button_reply") {
    const [action, questId] = msg.buttonId.split(":");
    if (questId && ["done", "skip", "later"].includes(action)) {
      await handleQuestCheckIn({ waId: msg.from, questId, action: action as QuestAction });
    }
  } else if (msg.type === "text") {
    await handleInboundText(msg.from);
  }

  // Log inbound message — best-effort (table may not exist in dev yet).
  await logInboundMessage(msg);

  return NextResponse.json({ ok: true });
}

// ── Inbound text handler ─────────────────────────────────────────────────────

async function handleInboundText(waId: string) {
  // NutriCoach is ambient/proactive — guide users to the nudge buttons rather
  // than trying to parse free-form text.
  await sendText(
    waId,
    "Hey! I'm NutriCoach 🥗 I'll send you personalized nutrition nudges based on your day.\n\n" +
    "Tap ✅ Done / ⏭️ Skip / 🔄 Later on your daily nudge to check in on your quests."
  ).catch((err) => console.error("[whatsapp/webhook] sendText error:", err));
}

// ── Message logging ───────────────────────────────────────────────────────────

async function logInboundMessage(msg: WaMessage) {
  const sb = getSupabase();
  if (!sb) return; // Supabase not configured yet — skip silently.

  const { data: profile } = await sb
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_wa_id", msg.from)
    .single();

  const body =
    msg.type === "text" ? msg.text
    : msg.type === "button_reply" ? msg.buttonTitle
    : msg.type;

  // Silently swallow errors — table may not exist in development yet.
  await sb.from("whatsapp_messages").insert({
    user_id: profile?.user_id ?? null,
    direction: "inbound",
    body,
    wa_message_id: msg.msgId,
  });
}

// ── Quest check-in logic ─────────────────────────────────────────────────────

type QuestAction = "done" | "skip" | "later";

async function handleQuestCheckIn(opts: {
  waId: string;
  questId: string;
  action: QuestAction;
}) {
  const { waId, questId, action } = opts;

  const sb = getSupabase();
  if (!sb) return; // Supabase not configured yet — skip silently.

  // Look up the user by their WhatsApp phone number (stored during onboarding).
  const { data: profile } = await sb
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_wa_id", waId)
    .single();

  if (!profile) return; // Unknown number — ignore silently.

  const userId = profile.user_id;

  // Append to the immutable quest_events log.
  await sb.from("quest_events").insert({
    user_id: userId,
    quest_id: questId,
    event_type: action,
    payload: { source: "whatsapp" },
  });

  if (action === "done") {
    // TODO (Builder 3): create the `increment_quest_progress` Supabase RPC in your migration.
    // Signature: (p_quest_id uuid, p_user_id uuid) → void
    // Should increment quests.progress->>'current' by 1 and set status='completed' when target is met.
    await sb.rpc("increment_quest_progress", { p_quest_id: questId, p_user_id: userId });

    const { data: quest } = await sb
      .from("quests")
      .select("xp_reward")
      .eq("id", questId)
      .single();

    if (quest?.xp_reward) {
      await sb.from("xp_ledger").insert({
        user_id: userId,
        delta: quest.xp_reward,
        reason: "quest_checkin_whatsapp",
        quest_id: questId,
      });
    }
  }
}
