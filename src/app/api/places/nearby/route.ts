import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { searchNearby } from "@/lib/places";
import type { Archetype } from "@/lib/profile";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const location = url.searchParams.get("location");
  if (!location || !location.trim()) {
    return NextResponse.json({ error: "location required" }, { status: 400 });
  }

  let archetype = (url.searchParams.get("archetype") as Archetype | null) ?? null;
  if (!archetype) {
    const { data: profile } = await getSupabaseAdmin()
      .from("profiles")
      .select("archetype")
      .eq("user_id", session.user.id)
      .maybeSingle();
    archetype = (profile?.archetype as Archetype) ?? "mixed";
  }

  try {
    const places = await searchNearby(location, archetype, 5);
    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : "places error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
