// ==========================================
// NutriCoach Mock Data
// ==========================================
// Replace with real Supabase queries when DB is set up

export type QuestStatus = "active" | "completed" | "skipped";

export interface Quest {
  id: string;
  title: string;
  description: string;
  progress: { current: number; target: number };
  xpReward: number;
  status: QuestStatus;
  icon: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpThreshold: number;
  earned: boolean;
  earnedAt?: string;
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  power: string;
  unlockXp: number;
  unlocked: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpNeeded: number;
  streak: number;
  activeCharacterId: string;
}

// ---- Quests ----
export const mockQuests: Quest[] = [
  {
    id: "q1",
    title: "Green Machine",
    description: "Log 5 meals with vegetables this week",
    progress: { current: 3, target: 5 },
    xpReward: 150,
    status: "active",
    icon: "🥦",
  },
  {
    id: "q2",
    title: "Protein Power",
    description: "Hit your protein goal 3 days in a row",
    progress: { current: 2, target: 3 },
    xpReward: 200,
    status: "active",
    icon: "💪",
  },
  {
    id: "q3",
    title: "Hydration Hero",
    description: "Drink 8 glasses of water today",
    progress: { current: 5, target: 8 },
    xpReward: 100,
    status: "active",
    icon: "💧",
  },
];

// ---- Challenges ----
export const mockChallenges = [
  {
    id: "c1",
    title: "7-Day Streak",
    description: "Log at least one meal every day for a week",
    progress: { current: 4, target: 7 },
    xpReward: 300,
    icon: "🔥",
    locked: false,
  },
  {
    id: "c2",
    title: "Veggie Week",
    description: "Include a vegetable in every meal for 7 days",
    progress: { current: 0, target: 7 },
    xpReward: 350,
    icon: "🥗",
    locked: false,
  },
  {
    id: "c3",
    title: "Sugar Detox",
    description: "Avoid added sugar for 5 days straight",
    progress: { current: 0, target: 5 },
    xpReward: 500,
    icon: "🚫",
    locked: true,
    lockReason: "Reach Level 3 to unlock",
  },
];

// ---- Badges ----
export const mockBadges: Badge[] = [
  {
    id: "b1",
    title: "First Quest",
    description: "Complete your very first quest",
    icon: "⭐",
    xpThreshold: 0,
    earned: true,
    earnedAt: "2026-04-01",
  },
  {
    id: "b2",
    title: "7-Day Streak",
    description: "Log meals 7 days in a row",
    icon: "🔥",
    xpThreshold: 300,
    earned: true,
    earnedAt: "2026-04-10",
  },
  {
    id: "b3",
    title: "Hydration Hero",
    description: "Complete the Hydration quest 5 times",
    icon: "💧",
    xpThreshold: 500,
    earned: true,
    earnedAt: "2026-04-14",
  },
  {
    id: "b4",
    title: "Veggie Lover",
    description: "Log 20 meals containing vegetables",
    icon: "🥦",
    xpThreshold: 750,
    earned: false,
  },
  {
    id: "b5",
    title: "Morning Champion",
    description: "Log breakfast 10 days in a row",
    icon: "🌅",
    xpThreshold: 1000,
    earned: false,
  },
  {
    id: "b6",
    title: "Traveler",
    description: "Use the app in 3 different cities",
    icon: "✈️",
    xpThreshold: 1500,
    earned: false,
  },
  {
    id: "b7",
    title: "Protein Pro",
    description: "Hit your protein goal 14 days in a row",
    icon: "💪",
    xpThreshold: 2000,
    earned: false,
  },
  {
    id: "b8",
    title: "Level 5 Legend",
    description: "Reach Level 5",
    icon: "🏆",
    xpThreshold: 2500,
    earned: false,
  },
];

// ---- Characters ----
export const mockCharacters: Character[] = [
  {
    id: "panda",
    name: "Panda Pete",
    emoji: "🐼",
    power: "Balance Master",
    unlockXp: 0,
    unlocked: true,
  },
  {
    id: "fox",
    name: "Fox Finn",
    emoji: "🦊",
    power: "Fiber Expert",
    unlockXp: 0,
    unlocked: true,
  },
  {
    id: "cactus",
    name: "Cactus Carl",
    emoji: "🌵",
    power: "Hydration King",
    unlockXp: 500,
    unlocked: false,
  },
  {
    id: "bunny",
    name: "Bunny Bea",
    emoji: "🐰",
    power: "Snack Wizard",
    unlockXp: 1000,
    unlocked: false,
  },
  {
    id: "owl",
    name: "Owl Omega",
    emoji: "🦉",
    power: "Omega-3 Guru",
    unlockXp: 1500,
    unlocked: false,
  },
  {
    id: "dragon",
    name: "Dragon Diet",
    emoji: "🐉",
    power: "Metabolism Booster",
    unlockXp: 2500,
    unlocked: false,
  },
];

// ---- User Profile ----
export const mockUserProfile: UserProfile = {
  id: "demo-user",
  name: "Alex",
  level: 2,
  xp: 320,
  xpNeeded: 500,
  streak: 4,
  activeCharacterId: "panda",
};

// ---- Demo accounts ----
export const demoAccounts = [
  {
    id: "traveler",
    label: "Traveler Demo",
    emoji: "✈️",
    profile: {
      ...mockUserProfile,
      name: "Sam",
      streak: 12,
      xp: 420,
      level: 3,
      activeCharacterId: "fox",
    },
  },
  {
    id: "student",
    label: "Student Demo",
    emoji: "🎓",
    profile: {
      ...mockUserProfile,
      name: "Jordan",
      streak: 3,
      xp: 150,
      level: 1,
      activeCharacterId: "panda",
    },
  },
];
