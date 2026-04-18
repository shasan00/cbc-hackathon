import type { Archetype } from "@/lib/profile";

export const SKIN_TONES = [
  { id: "light", hex: "#f1c59a", shadow: "#d9a77a" },
  { id: "tan", hex: "#d29a6b", shadow: "#a67448" },
  { id: "deep", hex: "#8b5a3a", shadow: "#5e3a22" },
  { id: "cool", hex: "#e8b895", shadow: "#c09372" },
] as const;

export const HAIR_COLORS = [
  { id: "ink", hex: "#2b2316", highlight: "#4a3f2a" },
  { id: "chestnut", hex: "#6b3a1a", highlight: "#8f5424" },
  { id: "straw", hex: "#c7923b", highlight: "#e6b94a" },
  { id: "berry", hex: "#8a2f44", highlight: "#b84a5e" },
  { id: "sage", hex: "#2d5039", highlight: "#5f8c4b" },
  { id: "ash", hex: "#6a7078", highlight: "#9aa4ad" },
] as const;

export const TUNIC_COLORS = [
  { id: "forest", body: "#2d5039", trim: "#5f8c4b" },
  { id: "berry", body: "#8a2f44", trim: "#b84a5e" },
  { id: "sky", body: "#3a6b88", trim: "#6ba4c9" },
  { id: "sunset", body: "#a0532a", trim: "#d87a3a" },
  { id: "dusk", body: "#3a2f5a", trim: "#6a5fa0" },
] as const;

export const HATS = [
  { id: "none", label: "None" },
  { id: "cap", label: "Explorer Cap" },
  { id: "band", label: "Headband" },
  { id: "beanie", label: "Beanie" },
] as const;

export type SkinTone = (typeof SKIN_TONES)[number]["id"];
export type HairColor = (typeof HAIR_COLORS)[number]["id"];
export type TunicColor = (typeof TUNIC_COLORS)[number]["id"];
export type Hat = (typeof HATS)[number]["id"];

export type Appearance = {
  skin: SkinTone;
  hair: HairColor;
  tunic: TunicColor;
  hat: Hat;
};

export const DEFAULT_APPEARANCE: Appearance = {
  skin: "light",
  hair: "ink",
  tunic: "forest",
  hat: "none",
};

function skin(id: SkinTone) {
  return SKIN_TONES.find((s) => s.id === id) ?? SKIN_TONES[0];
}
function hair(id: HairColor) {
  return HAIR_COLORS.find((h) => h.id === id) ?? HAIR_COLORS[0];
}
function tunic(id: TunicColor) {
  return TUNIC_COLORS.find((t) => t.id === id) ?? TUNIC_COLORS[0];
}

export function archetypeTunic(a: Archetype | null | undefined): TunicColor {
  switch (a) {
    case "traveler": return "sky";
    case "home_based": return "sunset";
    case "institutional": return "berry";
    case "mixed": return "forest";
    default: return "forest";
  }
}

export function archetypeLabel(a: Archetype | null | undefined): string {
  switch (a) {
    case "traveler": return "Traveler";
    case "home_based": return "Homebound";
    case "institutional": return "Regular";
    case "mixed": return "Wanderer";
    default: return "Adventurer";
  }
}

export function archetypeSubclass(
  a: Archetype | null | undefined,
  venue?: string,
): string {
  switch (a) {
    case "traveler": return "Red-eye Regular";
    case "home_based": return "Kitchen Sage";
    case "institutional": return venue === "school" ? "Dining Hall Scholar" : "Cafeteria Veteran";
    case "mixed": return "Jack-of-Plates";
    default: return "Novice";
  }
}

type Props = {
  archetype?: Archetype | null;
  appearance?: Partial<Appearance>;
  size?: number;
  bob?: boolean;
  className?: string;
};

export function Sprite({
  archetype = null,
  appearance,
  size = 96,
  bob = false,
  className = "",
}: Props) {
  const app: Appearance = { ...DEFAULT_APPEARANCE, ...appearance };
  const s = skin(app.skin);
  const h = hair(app.hair);
  const t = tunic(app.tunic);

  return (
    <svg
      className={`pixelated ${bob ? "anim-bob" : ""} ${className}`}
      width={size}
      height={(size * 28) / 24}
      viewBox="0 0 24 28"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* ground shadow */}
      <rect x="4" y="27" width="16" height="1" fill="#4a3f2a" opacity="0.4" />

      {/* hair — back layer, drawn behind hat */}
      {app.hat !== "beanie" && app.hat !== "cap" && (
        <>
          <rect x="7" y="2" width="10" height="1" fill={h.hex} />
          <rect x="6" y="3" width="12" height="2" fill={h.highlight} />
        </>
      )}
      <rect x="6" y="5" width="2" height="2" fill={h.highlight} />
      <rect x="16" y="5" width="2" height="2" fill={h.highlight} />

      {/* face */}
      <rect x="8" y="5" width="8" height="4" fill={s.hex} />
      <rect x="9" y="7" width="1" height="1" fill="#2b2316" />
      <rect x="14" y="7" width="1" height="1" fill="#2b2316" />
      <rect x="11" y="8" width="2" height="1" fill="#c65d5d" />

      {/* neck */}
      <rect x="10" y="9" width="4" height="1" fill={s.shadow} />

      {/* body / tunic */}
      <rect x="6" y="10" width="12" height="6" fill={t.body} />
      <rect x="6" y="10" width="12" height="1" fill={t.trim} />
      <rect x="11" y="11" width="2" height="4" fill="#e6b94a" />

      {/* arms */}
      <rect x="4" y="11" width="2" height="5" fill={t.body} />
      <rect x="18" y="11" width="2" height="5" fill={t.body} />
      <rect x="4" y="16" width="2" height="1" fill={s.hex} />
      <rect x="18" y="16" width="2" height="1" fill={s.hex} />

      {/* belt */}
      <rect x="6" y="16" width="12" height="1" fill="#1a2f22" />

      {/* legs */}
      <rect x="7" y="17" width="4" height="6" fill="#4a3f2a" />
      <rect x="13" y="17" width="4" height="6" fill="#4a3f2a" />

      {/* boots */}
      <rect x="6" y="23" width="5" height="3" fill="#2b2316" />
      <rect x="13" y="23" width="5" height="3" fill="#2b2316" />
      <rect x="6" y="25" width="5" height="1" fill="#4a3f2a" />
      <rect x="13" y="25" width="5" height="1" fill="#4a3f2a" />

      {/* tunic trim */}
      <rect x="6" y="15" width="12" height="1" fill={t.trim} />

      {/* archetype prop */}
      {archetype === "traveler" && (
        <>
          {/* canteen on right hand */}
          <rect x="19" y="17" width="3" height="4" fill="#6ba4c9" />
          <rect x="19" y="17" width="3" height="1" fill="#a5cde4" />
          <rect x="20" y="16" width="1" height="1" fill="#2b2316" />
        </>
      )}
      {archetype === "institutional" && (
        <>
          {/* backpack behind shoulders */}
          <rect x="3" y="11" width="1" height="6" fill="#8a2f44" />
          <rect x="20" y="11" width="1" height="6" fill="#8a2f44" />
          <rect x="5" y="17" width="14" height="2" fill="#6a2235" opacity="0.6" />
        </>
      )}
      {archetype === "home_based" && (
        <>
          {/* mug on right hand */}
          <rect x="19" y="16" width="3" height="3" fill="#d87a3a" />
          <rect x="19" y="16" width="3" height="1" fill="#f2a06a" />
          <rect x="22" y="17" width="1" height="1" fill="#d87a3a" />
          <rect x="20" y="15" width="2" height="1" fill="#fff" opacity="0.5" />
        </>
      )}
      {archetype === "mixed" && (
        <>
          {/* walking stick */}
          <rect x="20" y="10" width="1" height="14" fill="#6b3a1a" />
          <rect x="19" y="9" width="3" height="2" fill="#8f5424" />
        </>
      )}

      {/* hat */}
      {app.hat === "cap" && (
        <>
          <rect x="6" y="1" width="11" height="2" fill="#b84a5e" />
          <rect x="5" y="3" width="13" height="1" fill="#8a2f44" />
          <rect x="10" y="0" width="3" height="1" fill="#e6b94a" />
        </>
      )}
      {app.hat === "beanie" && (
        <>
          <rect x="6" y="1" width="12" height="3" fill={t.body} />
          <rect x="6" y="1" width="12" height="1" fill={t.trim} />
          <rect x="11" y="0" width="2" height="1" fill={t.trim} />
        </>
      )}
      {app.hat === "band" && (
        <rect x="6" y="4" width="12" height="1" fill="#b84a5e" />
      )}
    </svg>
  );
}

export function PortraitFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border-[3px] border-ink ${className}`}
      style={{
        background:
          "linear-gradient(var(--gb-pale) 60%, var(--gb-light) 60% 78%, var(--gb-mid) 78%)",
        imageRendering: "pixelated",
      }}
    >
      {/* distant trees */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-[18px]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 10px 18px, var(--gb-mid) 8px, transparent 9px),
            radial-gradient(circle at 34px 18px, var(--gb-mid) 10px, transparent 11px),
            radial-gradient(circle at 70px 18px, var(--gb-mid) 7px, transparent 8px),
            radial-gradient(circle at 100px 18px, var(--gb-mid) 11px, transparent 12px)`,
          backgroundRepeat: "repeat-x",
          backgroundSize: "140px 18px",
        }}
      />
      {/* pixel sun */}
      <div
        className="absolute top-[14px] right-[18px] h-[22px] w-[22px]"
        style={{
          background: "var(--gold)",
          boxShadow:
            "-4px 0 0 var(--gold), 4px 0 0 var(--gold), 0 -4px 0 var(--gold), 0 4px 0 var(--gold), 0 0 0 2px var(--ink)",
        }}
      />
      <span className="anim-twinkle absolute left-[40px] top-[22px] font-press text-[10px] text-gold">
        +
      </span>
      <span
        className="anim-twinkle absolute right-[56px] top-[60px] font-press text-[10px] text-gold"
        style={{ animationDelay: "0.5s" }}
      >
        *
      </span>
      {children}
    </div>
  );
}
