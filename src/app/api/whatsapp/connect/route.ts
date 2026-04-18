/**
 * POST /api/whatsapp/connect
 * Links a user's WhatsApp phone number to their profile.
 * Called from the onboarding flow after the user enters their phone number.
 *
 * Body:    { userId: string; phoneNumber: string }
 * Returns: { ok: true; waId: string }
 *
 * DELETE /api/whatsapp/connect
 * Disconnects WhatsApp nudges (Settings → "Pause WhatsApp nudges").
 * Body:    { userId: string }
 * Returns: { ok: true }
 *
 * TODO (Builder 1): Replace userId from body with the authenticated session user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  let body: { userId?: string; phoneNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { userId, phoneNumber } = body;
  if (!userId || !phoneNumber) {
    return NextResponse.json(
      { error: "userId and phoneNumber are required" },
      { status: 400 }
    );
  }

  // Normalise to E.164 digits-only (WhatsApp wa_id format — no '+').
  const waId = phoneNumber.replace(/\D/g, "");
  if (waId.length < 10 || waId.length > 15) {
    return NextResponse.json({ error: "invalid phone number" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_wa_id: waId })
    .eq("user_id", userId);

  if (error) {
    console.error("[whatsapp/connect] Supabase error:", error);
    return NextResponse.json(
      { error: "failed to link WhatsApp number" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, waId });
}

export async function DELETE(req: NextRequest) {
  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_wa_id: null })
    .eq("user_id", userId);

  if (error) {
    console.error("[whatsapp/connect] Supabase error:", error);
    return NextResponse.json(
      { error: "failed to disconnect WhatsApp" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
