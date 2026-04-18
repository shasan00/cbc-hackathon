import { auth } from "@/lib/auth";

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

export async function fetchUpcomingEvents(
  userId: string,
  opts: { days?: number; maxResults?: number } = {},
): Promise<CalendarEvent[]> {
  const { days = 7, maxResults = 50 } = opts;

  const { accessToken } = await auth.api.getAccessToken({
    body: { providerId: "google", userId },
  });

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).map(normalizeEvent);
}

function normalizeEvent(e: GoogleEvent): CalendarEvent {
  const startRaw = e.start?.dateTime ?? e.start?.date ?? "";
  const endRaw = e.end?.dateTime ?? e.end?.date ?? "";
  return {
    id: e.id,
    summary: e.summary ?? "(no title)",
    description: e.description,
    location: e.location,
    start: startRaw,
    end: endRaw,
    allDay: !e.start?.dateTime,
    htmlLink: e.htmlLink,
  };
}
