"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { PortraitFrame, Sprite } from "@/components/sprite";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [checkedProfile, setCheckedProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
          callbackURL: "/",
        });
        if (error) throw new Error(error.message ?? "Sign up failed");
      } else {
        const { error } = await signIn.email({
          email,
          password,
          callbackURL: "/",
        });
        if (error) throw new Error(error.message ?? "Sign in failed");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAuthBusy(false);
    }
  }

  useEffect(() => {
    if (isPending || !session?.user) {
      setCheckedProfile(true);
      return;
    }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile?.onboarding_completed_at) {
          setHasProfile(true);
          router.replace("/dashboard");
          return;
        }
      })
      .finally(() => setCheckedProfile(true));
  }, [isPending, session, router]);

  const signedIn = !!session?.user;
  const showTitleScreen = signedIn && checkedProfile && !hasProfile;

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* HUD */}
      <header
        className="mx-5 mt-5 grid items-center gap-3 border-[3px] border-ink bg-gb-darkest px-4 py-2 font-press text-[10px] text-gb-pale scanlines"
        style={{
          boxShadow: "4px 4px 0 var(--ink)",
          gridTemplateColumns: "auto 1fr auto",
        }}
      >
        <span className="flex items-center gap-2">
          <PixelLogo />
          <span className="text-gold">MEAL&nbsp;QUEST</span>
        </span>
        <span className="text-center text-gb-light">
          FIELD GUIDE v0.1
        </span>
        <span className="text-right">
          <span className="text-gb-light">PLAYER 1 </span>
          <span className="text-white">
            {signedIn ? truncEmail(session!.user.email ?? "") : "— INSERT COIN —"}
          </span>
        </span>
      </header>

      {/* Stage */}
      <section className="mx-5 mt-5 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Title card */}
        <div className="pixel-frame flex flex-col items-center justify-center overflow-hidden py-12 md:py-16">
          <p className="font-press text-[10px] text-ink-soft">
            ★ A FIELD GUIDE FOR EATING WELL IN REAL LIFE ★
          </p>
          <h1
            className="font-press mt-6 text-center leading-[1.1] text-ink"
            style={{ fontSize: "clamp(28px, 6.5vw, 72px)" }}
          >
            MEAL
            <br />
            <span className="text-gb-dark">QUEST</span>
          </h1>
          <p className="mt-6 max-w-[48ch] px-6 text-center font-silk text-[14px] leading-[1.6] text-ink-soft">
            An ambient nutrition coach for every lifestyle. Whether you&apos;re
            on a red-eye, in a dining hall, or staring into the fridge at home
            — small nudges, well-timed, no guilt.
          </p>

          {/* Meadow with hero sprite */}
          <PortraitFrame className="mt-10 h-[220px] w-[min(90%,520px)]">
            <div className="anim-bob absolute bottom-[18px] left-1/2 -translate-x-1/2">
              <Sprite archetype="traveler" size={128} />
            </div>
          </PortraitFrame>

          {/* Press start */}
          <div className="mt-10 flex flex-col items-center gap-4">
            {isPending || !checkedProfile ? (
              <p className="font-press text-[10px] text-ink-soft">
                LOADING…
              </p>
            ) : !signedIn ? (
              <div className="flex w-[min(90%,360px)] flex-col gap-3">
                <form onSubmit={handleEmailAuth} className="flex flex-col gap-2">
                  {mode === "signup" && (
                    <input
                      type="text"
                      placeholder="NAME"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="border-[3px] border-ink bg-paper px-3 py-2 font-press text-[10px] text-ink"
                    />
                  )}
                  <input
                    type="email"
                    required
                    placeholder="EMAIL"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-[3px] border-ink bg-paper px-3 py-2 font-press text-[10px] text-ink"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="PASSWORD (MIN 8)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-[3px] border-ink bg-paper px-3 py-2 font-press text-[10px] text-ink"
                  />
                  {authError && (
                    <p className="font-press text-[9px] text-berry">
                      {authError.toUpperCase()}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="pixel-btn pixel-btn-gold anim-press-pulse"
                    style={{ fontSize: "12px", padding: "14px 22px" }}
                  >
                    {authBusy
                      ? "…"
                      : mode === "signup"
                      ? "▶ CREATE ACCOUNT"
                      : "▶ PRESS START"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() =>
                    setMode(mode === "signup" ? "signin" : "signup")
                  }
                  className="font-press text-[9px] text-ink-soft underline"
                >
                  {mode === "signup"
                    ? "HAVE AN ACCOUNT? SIGN IN"
                    : "NEW PLAYER? CREATE ACCOUNT"}
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-[2px] flex-1 bg-ink-soft" />
                  <span className="font-press text-[8px] text-ink-soft">OR</span>
                  <div className="h-[2px] flex-1 bg-ink-soft" />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    signIn.social({ provider: "google", callbackURL: "/" })
                  }
                  className="pixel-btn"
                  style={{ fontSize: "10px", padding: "10px 14px" }}
                >
                  SIGN IN WITH GOOGLE
                </button>
              </div>
            ) : showTitleScreen ? (
              <button
                onClick={() => router.push("/onboarding")}
                className="pixel-btn pixel-btn-gold anim-press-pulse"
                style={{ fontSize: "12px", padding: "14px 22px" }}
              >
                ▶ PRESS START · NEW GAME
              </button>
            ) : (
              <p className="font-press text-[10px] text-ink-soft">
                ENTERING WORLD…
              </p>
            )}
            <p className="font-silk text-[12px] text-ink-soft">
              {signedIn
                ? "Let's build your character."
                : "Sign in or create an account to begin your adventure."}
            </p>
          </div>
        </div>

        {/* Side rail — features */}
        <aside className="flex flex-col gap-5">
          <FeatureCard
            tag="✦ ITINERARY-AWARE"
            title="Advice before the meal"
            body="Reads your calendar and nudges you before the 6:45 flight, not after."
          />
          <FeatureCard
            tag="✦ VENUE-PLAYBOOKS"
            title="Airport ≠ grocery store"
            body="Specific tactics for where you actually are — Hudson News, dining hall, or home."
            tone="berry"
          />
          <FeatureCard
            tag="✦ QUESTS, NOT STREAKS"
            title="Three of five still wins"
            body="Completable weekly quests. Cosmetics, never content, are gated."
            tone="sky"
          />
          <FeatureCard
            tag="✦ MULTI-LIFESTYLE"
            title="Same world, different class"
            body="Traveler, student, retiree, remote worker — one engine, different playbooks."
            tone="gold"
          />
        </aside>
      </section>

      {/* Footer / legend */}
      <footer
        className="mx-5 my-6 flex flex-wrap items-center justify-between gap-3 border-[3px] border-ink bg-paper px-4 py-3 font-silk text-[12px] text-ink-soft"
        style={{ boxShadow: "4px 4px 0 var(--ink)" }}
      >
        <span>
          Controls: <Kbd>↑↓</Kbd> nav · <Kbd>A</Kbd> confirm · <Kbd>B</Kbd> back
        </span>
        <span>v0.1 · field guide · Not medical advice.</span>
      </footer>
    </main>
  );
}

function FeatureCard({
  tag,
  title,
  body,
  tone = "green",
}: {
  tag: string;
  title: string;
  body: string;
  tone?: "green" | "berry" | "sky" | "gold";
}) {
  const toneColor =
    tone === "berry"
      ? "var(--berry)"
      : tone === "sky"
      ? "var(--sky)"
      : tone === "gold"
      ? "var(--gold)"
      : "var(--gb-dark)";
  return (
    <div className="pixel-frame" style={{ padding: "14px" }}>
      <div
        className="font-press text-[9px]"
        style={{ color: toneColor }}
      >
        {tag}
      </div>
      <div className="font-press mt-2 text-[11px] text-ink">
        {title}
      </div>
      <p className="font-silk mt-2 text-[13px] leading-[1.5] text-ink-soft">
        {body}
      </p>
    </div>
  );
}

function PixelLogo() {
  return (
    <span
      className="inline-block h-[22px] w-[22px]"
      style={{
        background:
          "linear-gradient(var(--gb-light),var(--gb-light)) 0 0/4px 4px, var(--gb-mid)",
        imageRendering: "pixelated",
        border: "2px solid var(--ink)",
      }}
    />
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="font-press mx-[2px] inline-block border-2 border-ink bg-ink px-[6px] py-[3px] text-[8px] text-cream"
      style={{ boxShadow: "2px 2px 0 var(--shadow)" }}
    >
      {children}
    </kbd>
  );
}

function truncEmail(e: string) {
  if (e.length <= 22) return e.toUpperCase();
  const [name, domain] = e.split("@");
  return `${name.slice(0, 10)}…@${domain}`.toUpperCase();
}
