import { auth } from "@/lib/auth";
import { fetchUpcomingEvents } from "@/lib/google-calendar";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const events = await fetchUpcomingEvents(session.user.id, { days: 7 });
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
