"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  BUDGET,
  COOK_FREQUENCY,
  DINING_HALL_TYPE,
  PREDICTABILITY,
  TRAVEL_FREQUENCY,
  venueFromArchetype,
  archetypeTitle,
  type Archetype,
  type Budget,
  type CookFrequency,
  type DiningHallType,
  type Predictability,
  type TravelFrequency,
} from "@/lib/profile";
import {
  DEFAULT_APPEARANCE,
  HAIR_COLORS,
  HATS,
  PortraitFrame,
  SKIN_TONES,
  Sprite,
  TUNIC_COLORS,
  type Appearance,
  type Hat,
  type HairColor,
  type SkinTone,
  type TunicColor,
} from "@/components/sprite";

type Step = "class" | "appearance" | "identity" | "stats" | "confirm" | "submitting";
const STEP_ORDER: Step[] = ["class", "appearance", "identity", "stats", "confirm"];

const ARCHETYPE_META: Record<
  Archetype,
  { title: string; subtitle: string; blurb: string; prop: string }
> = {
  traveler: {
    title: "THE TRAVELER",
    subtitle: "Red-eye regular",
    blurb: "Airports, hotels, cars, trains. Eats between gates.",
    prop: "Canteen+",
  },
  home_based: {
    title: "THE HOMEBOUND",
    subtitle: "Kitchen sage",
    blurb: "Home is the center of gravity. Cook, remote work, batch meals.",
    prop: "Warm mug",
  },
  institutional: {
    title: "THE REGULAR",
    subtitle: "Cafeteria veteran",
    blurb: "Dining hall, hospital cafeteria, campus — the same rotation every week.",
    prop: "Campus pack",
  },
  mixed: {
    title: "THE WANDERER",
    subtitle: "Jack-of-plates",
    blurb: "Some home, some travel, some chaos. The most common class.",
    prop: "Walking stick",
  },
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [step, setStep] = useState<Step>("class");
  const [archetype, setArchetype] = useState<Archetype>();
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [characterName, setCharacterName] = useState("");
  const [goal, setGoal] = useState("");
  const [predictability, setPredictability] = useState<Predictability>();
  const [nonNegotiables, setNonNegotiables] = useState("");
  const [travelFreq, setTravelFreq] = useState<TravelFrequency>();
  const [cookFreq, setCookFreq] = useState<CookFrequency>();
  const [budget, setBudget] = useState<Budget>();
  const [diningType, setDiningType] = useState<DiningHallType>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isPending && !session?.user) router.replace("/");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile?.onboarding_completed_at) router.replace("/dashboard");
      })
      .catch(() => {});
  }, [session, router]);

  const statsReady = (() => {
    if (!predictability || !archetype) return false;
    const venue = venueFromArchetype(archetype);
    if (venue === "on_the_go") return !!travelFreq;
    if (venue === "home") return !!cookFreq && !!budget;
    if (venue === "institutional") return !!diningType;
    if (venue === "mix") return !!cookFreq;
    return false;
  })();

  async function submit() {
    if (!archetype) return;
    setError(undefined);
    setStep("submitting");
    const venue = venueFromArchetype(archetype);
    const body = {
      archetype,
      goal,
      mode_preferences: {
        predictability,
        meal_venue: venue,
        travel_frequency: venue === "on_the_go" ? travelFreq : undefined,
        cook_frequency:
          venue === "home" || venue === "mix" ? cookFreq : undefined,
        budget: venue === "home" ? budget : undefined,
        dining_hall_type: venue === "institutional" ? diningType : undefined,
        character_name: characterName || undefined,
        appearance,
      },
      constraints: { non_negotiables: nonNegotiables },
    };
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "failed to save");
      setStep("confirm");
      return;
    }
    router.replace("/dashboard");
  }

  if (isPending || !session?.user) return null;

  const stepIndex = STEP_ORDER.indexOf(
    step === "submitting" ? "confirm" : step,
  );

  return (
    <main className="min-h-screen pb-10">
      {/* HUD */}
      <header
        className="mx-5 mt-5 grid items-center gap-3 border-[3px] border-ink bg-gb-darkest px-4 py-2 font-press text-[10px] text-gb-pale scanlines"
        style={{
          boxShadow: "4px 4px 0 var(--ink)",
          gridTemplateColumns: "auto 1fr auto",
        }}
      >
        <span className="text-gold">★ CHARACTER CREATION</span>
        <span className="text-center text-gb-light">
          {STEP_TITLE[step]}
        </span>
        <span className="text-right">
          STEP <span className="text-white">{stepIndex + 1}</span> /{" "}
          <span className="text-white">{STEP_ORDER.length}</span>
        </span>
      </header>

      <div className="mx-5 mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Character preview */}
        <aside className="pixel-frame flex flex-col gap-4">
          <span className="font-press text-[9px] text-ink-soft">
            ★ PREVIEW
          </span>
          <PortraitFrame className="h-[220px]">
            <div className="anim-bob absolute bottom-[18px] left-1/2 -translate-x-1/2">
              <Sprite archetype={archetype ?? null} appearance={appearance} size={128} />
            </div>
          </PortraitFrame>

          <div className="border-t-[3px] border-dashed border-ink-soft pt-3">
            <div className="font-press text-[12px] text-ink">
              {characterName.trim() || "— UNNAMED —"}
            </div>
            <div className="font-silk text-[13px] text-ink-soft">
              {archetype ? `Class: ${archetypeTitle(archetype)}` : "No class selected"}
            </div>
          </div>

          <div
            className="border-[3px] border-ink bg-gb-darkest p-3 text-gb-pale scanlines"
            style={{ boxShadow: "3px 3px 0 var(--ink)" }}
          >
            <div className="font-press text-[8px] text-gold">
              SAGE · ambient coach
            </div>
            <p className="mt-2 font-pixel text-[14px] leading-[1.45]">
              {STEP_TIP[step]}
            </p>
          </div>
        </aside>

        {/* Body */}
        <section className="pixel-frame anim-pop" key={step}>
          {step === "class" && (
            <ClassSelect value={archetype} onChange={setArchetype} appearance={appearance} />
          )}
          {step === "appearance" && (
            <AppearanceEdit
              archetype={archetype!}
              appearance={appearance}
              onChange={setAppearance}
            />
          )}
          {step === "identity" && (
            <Identity
              characterName={characterName}
              setCharacterName={setCharacterName}
              goal={goal}
              setGoal={setGoal}
            />
          )}
          {step === "stats" && (
            <StatsStep
              archetype={archetype!}
              predictability={predictability}
              setPredictability={setPredictability}
              nonNegotiables={nonNegotiables}
              setNonNegotiables={setNonNegotiables}
              travelFreq={travelFreq}
              setTravelFreq={setTravelFreq}
              cookFreq={cookFreq}
              setCookFreq={setCookFreq}
              budget={budget}
              setBudget={setBudget}
              diningType={diningType}
              setDiningType={setDiningType}
            />
          )}
          {step === "confirm" && (
            <Confirm
              archetype={archetype!}
              appearance={appearance}
              characterName={characterName}
              goal={goal}
              error={error}
            />
          )}
          {step === "submitting" && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-16">
              <p className="font-press text-[10px] text-ink-soft">
                ★ SAVING YOUR CHARACTER…
              </p>
              <p className="font-pixel text-[14px] text-ink">
                Binding the field guide. One moment.
              </p>
            </div>
          )}

          {/* nav */}
          {step !== "submitting" && (
            <div className="mt-10 flex items-center justify-between border-t-[3px] border-dashed border-ink-soft pt-5">
              <button
                className="pixel-btn"
                disabled={stepIndex === 0}
                onClick={() => setStep(STEP_ORDER[stepIndex - 1])}
              >
                ◀ BACK
              </button>
              {step !== "confirm" ? (
                <button
                  className="pixel-btn pixel-btn-go"
                  disabled={!canAdvance(step, {
                    archetype,
                    characterName,
                    goal,
                    statsReady,
                  })}
                  onClick={() => setStep(STEP_ORDER[stepIndex + 1])}
                >
                  NEXT ▶
                </button>
              ) : (
                <button className="pixel-btn pixel-btn-gold" onClick={submit}>
                  ▶ BEGIN ADVENTURE
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const STEP_TITLE: Record<Step, string> = {
  class: "CH. I · CHOOSE YOUR CLASS",
  appearance: "CH. II · APPEARANCE",
  identity: "CH. III · NAME YOUR QUEST",
  stats: "CH. IV · STATS",
  confirm: "CH. V · CONFIRM",
  submitting: "SAVING…",
};

const STEP_TIP: Record<Step, string> = {
  class:
    "Your class tells me where you eat. It changes the playbooks I'll use — airports, home kitchens, dining halls — not the coaching itself.",
  appearance:
    "Pure cosmetic. Coaching is never gated; your look is just for you. Mix and match — respec anytime later.",
  identity:
    "One line about what you're trying to do. In your own words. I don't fit you into a box.",
  stats:
    "A few gate questions to tune the nudges. Nothing locks you in — you can change these from settings.",
  confirm:
    "All set, adventurer? Begin the adventure and I'll start pulling your calendar and building quests.",
  submitting: "Binding…",
};

function canAdvance(
  step: Step,
  s: {
    archetype?: Archetype;
    characterName: string;
    goal: string;
    statsReady: boolean;
  },
) {
  if (step === "class") return !!s.archetype;
  if (step === "appearance") return !!s.archetype;
  if (step === "identity") return s.characterName.trim().length > 0 && s.goal.trim().length > 0;
  if (step === "stats") return s.statsReady;
  return true;
}

/* ================================ CLASS ================================= */
function ClassSelect({
  value,
  onChange,
  appearance,
}: {
  value: Archetype | undefined;
  onChange: (a: Archetype) => void;
  appearance: Appearance;
}) {
  const classes: Archetype[] = ["traveler", "home_based", "institutional", "mixed"];
  return (
    <div>
      <h2 className="font-press text-[14px] text-ink">
        ★ Choose your class
      </h2>
      <p className="font-silk mt-2 text-[13px] text-ink-soft">
        Where do most of your meals happen? Pick the class that best fits your
        life — it changes your playbooks, not your coaching.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {classes.map((a) => {
          const active = value === a;
          const meta = ARCHETYPE_META[a];
          return (
            <button
              key={a}
              onClick={() => onChange(a)}
              className="relative flex items-start gap-4 border-[3px] border-ink bg-cream p-4 text-left transition-all hover:-translate-y-[1px]"
              style={{
                boxShadow: active ? "5px 5px 0 var(--gold)" : "4px 4px 0 var(--ink)",
                background: active ? "var(--paper)" : undefined,
              }}
            >
              {active && (
                <span
                  className="font-press absolute -top-2 -left-2 bg-gold px-2 py-1 text-[8px] text-ink border-[3px] border-ink"
                >
                  ★ SELECTED
                </span>
              )}
              <div
                className="flex h-[120px] w-[90px] shrink-0 items-end justify-center border-[3px] border-ink"
                style={{
                  background:
                    "linear-gradient(var(--gb-pale) 70%, var(--gb-light) 70%)",
                }}
              >
                <Sprite archetype={a} appearance={appearance} size={72} />
              </div>
              <div className="min-w-0">
                <div className="font-press text-[11px] text-ink">
                  {meta.title}
                </div>
                <div className="font-silk mt-1 text-[12px] text-ink-soft">
                  {meta.subtitle}
                </div>
                <p className="font-pixel mt-2 text-[14px] leading-[1.4] text-ink">
                  {meta.blurb}
                </p>
                <div className="font-silk mt-3 text-[11px] text-sunset">
                  Signature: {meta.prop}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================= APPEARANCE =============================== */
function AppearanceEdit({
  archetype,
  appearance,
  onChange,
}: {
  archetype: Archetype;
  appearance: Appearance;
  onChange: (a: Appearance) => void;
}) {
  const set = (patch: Partial<Appearance>) => onChange({ ...appearance, ...patch });
  return (
    <div>
      <h2 className="font-press text-[14px] text-ink">
        ★ Customize your look
      </h2>
      <p className="font-silk mt-2 text-[13px] text-ink-soft">
        Pure cosmetic. Pick anything — coaching is never gated.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <SwatchRow
          label="SKIN TONE"
          active={appearance.skin}
          onPick={(id) => set({ skin: id as SkinTone })}
          swatches={SKIN_TONES.map((s) => ({ id: s.id, color: s.hex }))}
        />
        <SwatchRow
          label="HAIR"
          active={appearance.hair}
          onPick={(id) => set({ hair: id as HairColor })}
          swatches={HAIR_COLORS.map((h) => ({ id: h.id, color: h.hex }))}
        />
        <SwatchRow
          label="TUNIC"
          active={appearance.tunic}
          onPick={(id) => set({ tunic: id as TunicColor })}
          swatches={TUNIC_COLORS.map((t) => ({ id: t.id, color: t.body }))}
        />
        <div>
          <div className="font-press text-[9px] text-ink-soft">HAT</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {HATS.map((h) => (
              <button
                key={h.id}
                onClick={() => set({ hat: h.id as Hat })}
                className="pixel-btn"
                style={{
                  fontSize: "9px",
                  padding: "8px 10px",
                  background: appearance.hat === h.id ? "var(--gold)" : "var(--paper)",
                }}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="font-silk mt-6 text-[12px] text-ink-soft">
        Class signature item (<b>{ARCHETYPE_META[archetype].prop}</b>) comes
        with your class and appears in the preview.
      </div>
    </div>
  );
}

function SwatchRow({
  label,
  active,
  onPick,
  swatches,
}: {
  label: string;
  active: string;
  onPick: (id: string) => void;
  swatches: { id: string; color: string }[];
}) {
  return (
    <div>
      <div className="font-press text-[9px] text-ink-soft">
        {label}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {swatches.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            aria-label={s.id}
            className="h-10 w-10 border-[3px] border-ink"
            style={{
              background: s.color,
              boxShadow:
                active === s.id
                  ? "3px 3px 0 var(--gold), inset 0 0 0 2px var(--cream)"
                  : "3px 3px 0 var(--shadow)",
              transform: active === s.id ? "translate(-1px,-1px)" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================= IDENTITY ================================= */
function Identity({
  characterName,
  setCharacterName,
  goal,
  setGoal,
}: {
  characterName: string;
  setCharacterName: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="font-press text-[14px] text-ink">
        ★ Name your quest
      </h2>
      <p className="font-silk mt-2 text-[13px] text-ink-soft">
        A handle for your character, and a line about what you&apos;re trying
        to achieve.
      </p>

      <div className="mt-6">
        <label className="pixel-label">CHARACTER NAME</label>
        <input
          className="pixel-input mt-2"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          maxLength={24}
          placeholder="NATE THE NOMAD"
          style={{ textTransform: "uppercase" }}
        />
        <div className="font-silk mt-1 text-[11px] text-ink-soft">
          {characterName.length}/24
        </div>
      </div>

      <div className="mt-6">
        <label className="pixel-label">YOUR QUEST (in your own words)</label>
        <textarea
          className="pixel-input mt-2"
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={500}
          placeholder="e.g. Eat better while traveling for work — fewer 10pm hotel burgers."
        />
        <div className="font-silk mt-1 text-[11px] text-ink-soft">
          {goal.length}/500
        </div>
      </div>
    </div>
  );
}

/* =============================== STATS ================================== */
function StatsStep(props: {
  archetype: Archetype;
  predictability: Predictability | undefined;
  setPredictability: (v: Predictability) => void;
  nonNegotiables: string;
  setNonNegotiables: (v: string) => void;
  travelFreq: TravelFrequency | undefined;
  setTravelFreq: (v: TravelFrequency) => void;
  cookFreq: CookFrequency | undefined;
  setCookFreq: (v: CookFrequency) => void;
  budget: Budget | undefined;
  setBudget: (v: Budget) => void;
  diningType: DiningHallType | undefined;
  setDiningType: (v: DiningHallType) => void;
}) {
  const venue = venueFromArchetype(props.archetype);

  return (
    <div>
      <h2 className="font-press text-[14px] text-ink">
        ★ Allocate your stats
      </h2>
      <p className="font-silk mt-2 text-[13px] text-ink-soft">
        These tune the nudges I send. You can change them anytime.
      </p>

      <div className="mt-6 space-y-6">
        <QuestionRow
          label="How predictable is your week?"
          options={PREDICTABILITY}
          labels={{
            rigid: "Rigid",
            mixed: "Mixed",
            chaotic: "Chaotic",
          }}
          value={props.predictability}
          onChange={props.setPredictability}
        />

        {venue === "on_the_go" && (
          <QuestionRow
            label="How often do you travel?"
            options={TRAVEL_FREQUENCY}
            labels={{
              weekly: "Weekly",
              monthly: "Monthly",
              occasional: "Occasional",
            }}
            value={props.travelFreq}
            onChange={props.setTravelFreq}
          />
        )}

        {(venue === "home" || venue === "mix") && (
          <QuestionRow
            label="How often do you cook?"
            options={COOK_FREQUENCY}
            labels={{
              daily: "Daily",
              few_times_week: "Few × week",
              rarely: "Rarely",
            }}
            value={props.cookFreq}
            onChange={props.setCookFreq}
          />
        )}

        {venue === "home" && (
          <QuestionRow
            label="Grocery budget?"
            options={BUDGET}
            labels={{ tight: "Tight", moderate: "Moderate", flexible: "Flexible" }}
            value={props.budget}
            onChange={props.setBudget}
          />
        )}

        {venue === "institutional" && (
          <QuestionRow
            label="What kind of dining hall?"
            options={DINING_HALL_TYPE}
            labels={{ school: "School", work: "Work", other: "Other" }}
            value={props.diningType}
            onChange={props.setDiningType}
          />
        )}

        <div>
          <label className="pixel-label">
            Non-negotiables (allergies, medical, religious, preferences)
          </label>
          <input
            className="pixel-input mt-2"
            value={props.nonNegotiables}
            onChange={(e) => props.setNonNegotiables(e.target.value)}
            placeholder="Optional — e.g. peanut allergy, no pork, T1 diabetic"
            maxLength={500}
          />
        </div>
      </div>
    </div>
  );
}

function QuestionRow<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="pixel-label">{label}</label>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="pixel-btn"
              style={{
                fontSize: "9px",
                padding: "8px 10px",
                background: active ? "var(--gb-mid)" : "var(--paper)",
                color: active ? "#fff" : "var(--ink)",
              }}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== CONFIRM ================================= */
function Confirm({
  archetype,
  appearance,
  characterName,
  goal,
  error,
}: {
  archetype: Archetype;
  appearance: Appearance;
  characterName: string;
  goal: string;
  error?: string;
}) {
  return (
    <div>
      <h2 className="font-press text-[14px] text-ink">
        ★ Review your character
      </h2>
      <p className="font-silk mt-2 text-[13px] text-ink-soft">
        Everything look right? Begin the adventure to save and start receiving
        nudges.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-[200px_1fr]">
        <div
          className="flex h-[220px] items-end justify-center border-[3px] border-ink"
          style={{
            background: "linear-gradient(var(--gb-pale) 70%, var(--gb-light) 70%)",
            boxShadow: "4px 4px 0 var(--ink)",
          }}
        >
          <div className="anim-bob mb-4">
            <Sprite archetype={archetype} appearance={appearance} size={128} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Row k="NAME" v={characterName.toUpperCase() || "—"} />
          <Row k="CLASS" v={archetypeTitle(archetype)} />
          <Row k="QUEST" v={goal} />
        </div>
      </div>

      {error && (
        <div
          className="font-press mt-6 border-[3px] border-berry bg-rose px-3 py-2 text-[10px] text-ink"
          style={{ boxShadow: "3px 3px 0 var(--ink)" }}
        >
          ✕ {error}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] items-start gap-3 border-b-[2px] border-dashed border-ink-soft pb-2">
      <span className="font-press text-[9px] text-ink-soft">{k}</span>
      <span className="font-pixel text-[15px] text-ink">{v}</span>
    </div>
  );
}
