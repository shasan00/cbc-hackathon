import type { Archetype } from "@/lib/profile";

export type QuestTone = "water" | "veg" | "move" | "sleep";

export type QuestTemplate = {
  template_id: string;
  tone: QuestTone;
  title: string;
  description: string;
  target: { count: number; unit: string };
  xp_reward: number;
};

const COMMON: QuestTemplate[] = [
  {
    template_id: "hydra_hunter",
    tone: "water",
    title: "HYDRA HUNTER",
    description: "Drink 6 cups of water before the end of the day.",
    target: { count: 6, unit: "cups" },
    xp_reward: 40,
  },
  {
    template_id: "lights_out",
    tone: "sleep",
    title: "LIGHTS OUT",
    description: "In-bed wind-down before 23:00 local. No screens after dinner.",
    target: { count: 1, unit: "night" },
    xp_reward: 60,
  },
];

const PER_ARCHETYPE: Record<Archetype, QuestTemplate[]> = {
  traveler: [
    ...COMMON,
    {
      template_id: "green_gambit_traveler",
      tone: "veg",
      title: "GREEN GAMBIT",
      description: "Veg-forward meal at a terminal eatery — find a bowl or salad.",
      target: { count: 1, unit: "meal" },
      xp_reward: 80,
    },
    {
      template_id: "concourse_dash",
      tone: "move",
      title: "CONCOURSE DASH",
      description: "Walk to the far gate instead of the tram. 1,800 steps.",
      target: { count: 1800, unit: "steps" },
      xp_reward: 35,
    },
  ],
  home_based: [
    ...COMMON,
    {
      template_id: "green_gambit_home",
      tone: "veg",
      title: "GREEN GAMBIT",
      description: "Cook one veg-forward dinner this week with what's in the fridge.",
      target: { count: 1, unit: "meal" },
      xp_reward: 80,
    },
    {
      template_id: "kitchen_roam",
      tone: "move",
      title: "KITCHEN ROAM",
      description: "Take a 15-minute walk between meetings or after lunch.",
      target: { count: 1, unit: "walk" },
      xp_reward: 35,
    },
  ],
  institutional: [
    ...COMMON,
    {
      template_id: "green_gambit_institutional",
      tone: "veg",
      title: "GREEN GAMBIT",
      description: "Fill half your tray with greens at the salad bar today.",
      target: { count: 1, unit: "meal" },
      xp_reward: 80,
    },
    {
      template_id: "stairs_only",
      tone: "move",
      title: "STAIRS ONLY",
      description: "Take the stairs instead of the elevator all day.",
      target: { count: 1, unit: "day" },
      xp_reward: 35,
    },
  ],
  mixed: [
    ...COMMON,
    {
      template_id: "green_gambit_mixed",
      tone: "veg",
      title: "GREEN GAMBIT",
      description: "One veg-forward meal this week, wherever you are.",
      target: { count: 1, unit: "meal" },
      xp_reward: 80,
    },
    {
      template_id: "move_break",
      tone: "move",
      title: "MOVE BREAK",
      description: "A 15-minute walk today. Outside preferred.",
      target: { count: 1, unit: "walk" },
      xp_reward: 35,
    },
  ],
};

export function templatesFor(archetype: Archetype): QuestTemplate[] {
  return PER_ARCHETYPE[archetype] ?? PER_ARCHETYPE.mixed;
}

export function toneFromTemplateId(id: string): QuestTone {
  if (id.startsWith("hydra")) return "water";
  if (id.startsWith("green")) return "veg";
  if (id.startsWith("lights")) return "sleep";
  return "move";
}

export function weekEndIso(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSun = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSun);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
