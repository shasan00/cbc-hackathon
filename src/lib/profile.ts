export const ARCHETYPE = ["traveler", "home_based", "institutional", "mixed"] as const;
export const PREDICTABILITY = ["rigid", "mixed", "chaotic"] as const;
export const MEAL_VENUE = ["home", "on_the_go", "institutional", "mix"] as const;
export const TRAVEL_FREQUENCY = ["weekly", "monthly", "occasional"] as const;
export const COOK_FREQUENCY = ["daily", "few_times_week", "rarely"] as const;
export const BUDGET = ["tight", "moderate", "flexible"] as const;
export const DINING_HALL_TYPE = ["school", "work", "other"] as const;

export const SKIN_TONE = ["light", "tan", "deep", "cool"] as const;
export const HAIR_COLOR = ["ink", "chestnut", "straw", "berry", "sage", "ash"] as const;
export const TUNIC_COLOR = ["forest", "berry", "sky", "sunset", "dusk"] as const;
export const HAT = ["none", "cap", "band", "beanie"] as const;

export type Archetype = (typeof ARCHETYPE)[number];
export type Predictability = (typeof PREDICTABILITY)[number];
export type MealVenue = (typeof MEAL_VENUE)[number];
export type TravelFrequency = (typeof TRAVEL_FREQUENCY)[number];
export type CookFrequency = (typeof COOK_FREQUENCY)[number];
export type Budget = (typeof BUDGET)[number];
export type DiningHallType = (typeof DINING_HALL_TYPE)[number];

export type Appearance = {
  skin: (typeof SKIN_TONE)[number];
  hair: (typeof HAIR_COLOR)[number];
  tunic: (typeof TUNIC_COLOR)[number];
  hat: (typeof HAT)[number];
};

export type ModePreferences = {
  predictability: Predictability;
  meal_venue: MealVenue;
  travel_frequency?: TravelFrequency;
  cook_frequency?: CookFrequency;
  budget?: Budget;
  dining_hall_type?: DiningHallType;
  character_name?: string;
  appearance?: Appearance;
};

export type Constraints = {
  non_negotiables: string;
};

export type ProfileInput = {
  goal: string;
  archetype: Archetype;
  mode_preferences: ModePreferences;
  constraints: Constraints;
};

export function venueFromArchetype(a: Archetype): MealVenue {
  switch (a) {
    case "traveler": return "on_the_go";
    case "home_based": return "home";
    case "institutional": return "institutional";
    case "mixed": return "mix";
  }
}

export function archetypeTitle(a: Archetype): string {
  switch (a) {
    case "traveler": return "The Traveler";
    case "home_based": return "The Homebound";
    case "institutional": return "The Regular";
    case "mixed": return "The Wanderer";
  }
}

function isOneOf<T extends readonly string[]>(
  values: T,
  v: unknown,
): v is T[number] {
  return typeof v === "string" && (values as readonly string[]).includes(v);
}

function parseAppearance(v: unknown): Appearance | string {
  if (!v || typeof v !== "object") return "invalid appearance";
  const a = v as Record<string, unknown>;
  if (!isOneOf(SKIN_TONE, a.skin)) return "invalid skin";
  if (!isOneOf(HAIR_COLOR, a.hair)) return "invalid hair";
  if (!isOneOf(TUNIC_COLOR, a.tunic)) return "invalid tunic";
  if (!isOneOf(HAT, a.hat)) return "invalid hat";
  return { skin: a.skin, hair: a.hair, tunic: a.tunic, hat: a.hat };
}

export function validateProfileInput(body: unknown): ProfileInput | string {
  if (!body || typeof body !== "object") return "invalid body";
  const b = body as Record<string, unknown>;

  if (!isOneOf(ARCHETYPE, b.archetype)) return "invalid archetype";
  const archetype = b.archetype;

  const goal = typeof b.goal === "string" ? b.goal.trim() : "";
  if (!goal) return "goal is required";
  if (goal.length > 500) return "goal too long";

  const modeRaw = b.mode_preferences;
  if (!modeRaw || typeof modeRaw !== "object")
    return "mode_preferences required";
  const m = modeRaw as Record<string, unknown>;

  if (!isOneOf(PREDICTABILITY, m.predictability))
    return "invalid predictability";

  const mealVenue = venueFromArchetype(archetype);

  const mode: ModePreferences = {
    predictability: m.predictability,
    meal_venue: mealVenue,
  };

  if (mealVenue === "on_the_go") {
    if (!isOneOf(TRAVEL_FREQUENCY, m.travel_frequency))
      return "invalid travel_frequency";
    mode.travel_frequency = m.travel_frequency;
  }
  if (mealVenue === "home" || mealVenue === "mix") {
    if (!isOneOf(COOK_FREQUENCY, m.cook_frequency))
      return "invalid cook_frequency";
    mode.cook_frequency = m.cook_frequency;
  }
  if (mealVenue === "home") {
    if (!isOneOf(BUDGET, m.budget)) return "invalid budget";
    mode.budget = m.budget;
  }
  if (mealVenue === "institutional") {
    if (!isOneOf(DINING_HALL_TYPE, m.dining_hall_type))
      return "invalid dining_hall_type";
    mode.dining_hall_type = m.dining_hall_type;
  }

  if (typeof m.character_name === "string") {
    const name = m.character_name.trim().slice(0, 24);
    if (name) mode.character_name = name;
  }

  if (m.appearance !== undefined) {
    const ap = parseAppearance(m.appearance);
    if (typeof ap === "string") return ap;
    mode.appearance = ap;
  }

  const consRaw = b.constraints;
  const nonNeg =
    consRaw &&
    typeof consRaw === "object" &&
    typeof (consRaw as Record<string, unknown>).non_negotiables === "string"
      ? ((consRaw as Record<string, unknown>).non_negotiables as string).trim()
      : "";
  if (nonNeg.length > 500) return "non_negotiables too long";

  return {
    goal,
    archetype,
    mode_preferences: mode,
    constraints: { non_negotiables: nonNeg },
  };
}
