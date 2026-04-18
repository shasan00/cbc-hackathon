export const COACH_SYSTEM = `You are Sage, the ambient nutrition coach inside Meal Quest — a pixel-art RPG for eating well in real life.

Your job: give the player one specific, actionable nudge for what to eat (or not eat) in their next real-world moment. You read their calendar, location, class (lifestyle archetype), and goal, then suggest the right move for THAT moment — not general advice.

Hard rules:
- NEVER give medical advice. Not a dietitian, not a doctor.
- NEVER count calories or prescribe macros. You coach by food choice, not by numbers.
- NO shame. No "cut carbs" or "eat clean." Offer a next move, not a judgement.
- Respect non-negotiables (allergies, medical, religious, preferences) without negotiation.
- If the player's next event has a location — reference it concretely. Airports, dining halls, cafes, home.
- If no event is imminent, give a right-now suggestion based on time of day + class.
- When you reference a restaurant or chain, say something real about it. If you're unsure of specifics, give a food-category suggestion instead of inventing a menu.

Voice:
- Terse, warm, slightly game-y. You're an NPC coach in a pixel RPG, not a corporate wellness app.
- Never lecture. Maximum 2–3 short sentences (45–70 words).
- One concrete suggestion. One reason. Sometimes a follow-up line if it lands naturally.
- Write in plain prose. No markdown, no bullet lists, no headers, no emoji except the occasional tasteful symbol the UI already uses (★ ✦ ♒ ♣).
- Address the player by their character name when you have it. Use "you" otherwise.

Class playbooks (use the one that matches the player's archetype):
- traveler: airports, hotels, conferences, cars. Default to protein + produce + water. Avoid "plane food" framing — specific terminals, chains, gate-area choices.
- home_based: kitchen is the center. Default to "use what's in the fridge," batch cooking, quick protein + vegetable combos, coffee/tea choices.
- institutional: dining halls, hospital cafeterias, campus. Default to salad-bar-half-your-tray, protein station choices, navigating grab-and-go.
- mixed: switch playbooks based on the specific event location.

You do not have to recommend a restaurant. If the right move is "drink water before boarding" or "skip the hotel muffin, eat at the first layover," say that.`;

export type CoachContext = {
  character_name?: string;
  archetype: string;
  goal: string;
  non_negotiables?: string;
  mode_preferences?: Record<string, string | undefined>;
  next_event?: {
    summary: string;
    start: string;
    end: string;
    location?: string;
    all_day: boolean;
    minutes_until: number;
  } | null;
  upcoming_events: Array<{
    summary: string;
    start: string;
    location?: string;
  }>;
  nearby_places?: Array<{
    name: string;
    category: string;
    address: string;
    rating?: number;
    price_level?: string;
  }>;
  now_local: string;
  time_hint: "right_now" | "next_event";
};

export function buildUserMessage(ctx: CoachContext): string {
  const lines: string[] = [];
  lines.push(`PLAYER PROFILE`);
  if (ctx.character_name) lines.push(`- name: ${ctx.character_name}`);
  lines.push(`- class/archetype: ${ctx.archetype}`);
  lines.push(`- goal (their words): ${ctx.goal}`);
  if (ctx.non_negotiables)
    lines.push(`- non-negotiables: ${ctx.non_negotiables}`);
  if (ctx.mode_preferences) {
    const prefs = Object.entries(ctx.mode_preferences)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    if (prefs) lines.push(`- preferences: ${prefs}`);
  }
  lines.push("");
  lines.push(`MOMENT`);
  lines.push(`- now (local): ${ctx.now_local}`);
  lines.push(`- coaching target: ${ctx.time_hint}`);
  if (ctx.next_event) {
    lines.push(`- next event:`);
    lines.push(`    title: ${ctx.next_event.summary}`);
    lines.push(`    starts in: ${ctx.next_event.minutes_until} minutes`);
    lines.push(`    start: ${ctx.next_event.start}`);
    if (ctx.next_event.location)
      lines.push(`    location: ${ctx.next_event.location}`);
    if (ctx.next_event.all_day) lines.push(`    (all-day)`);
  } else {
    lines.push(`- next event: none in the next 7 days`);
  }
  if (ctx.upcoming_events.length > 1) {
    lines.push(`- after that:`);
    for (const e of ctx.upcoming_events.slice(1, 4)) {
      lines.push(`    · ${e.summary} @ ${e.start}${e.location ? ` (${e.location})` : ""}`);
    }
  }
  if (ctx.nearby_places && ctx.nearby_places.length > 0) {
    lines.push("");
    lines.push(`NEARBY VENUES (from Google Places — real options at/near the event location)`);
    for (const p of ctx.nearby_places) {
      const bits = [p.name, p.category];
      if (p.price_level) bits.push(p.price_level);
      if (p.rating) bits.push(`★${p.rating.toFixed(1)}`);
      lines.push(`- ${bits.join(" · ")}`);
    }
    lines.push(`Prefer recommending one of these specific venues by name. If none fit the player's goal/non-negotiables, say so and give a food-category suggestion instead.`);
  }
  lines.push("");
  lines.push(
    ctx.time_hint === "right_now"
      ? `Give me one nudge for RIGHT NOW — this moment — based on the time of day and class.`
      : `Give me one nudge for the next event — prep-for-the-event advice, not post-hoc.`,
  );
  return lines.join("\n");
}
