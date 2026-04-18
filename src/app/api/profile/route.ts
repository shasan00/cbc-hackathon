import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { validateProfileInput } from "@/lib/profile";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = validateProfileInput(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .upsert(
      {
        user_id: session.user.id,
        goal: parsed.goal,
        archetype: parsed.archetype,
        mode_preferences: parsed.mode_preferences,
        constraints: parsed.constraints,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}
