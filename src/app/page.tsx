"use client";

import { Button } from "@/components/ui/button";
import { signIn, signOut, useSession } from "@/lib/auth-client";

export default function Home() {
  const { data: session, isPending } = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Ambient Health Coach
      </h1>
      <p className="max-w-md text-center text-muted-foreground">
        Itinerary-aware nudges from your calendar, location, and goals.
      </p>

      {isPending ? null : session?.user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm">Signed in as {session.user.email}</p>
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      ) : (
        <Button
          onClick={() =>
            signIn.social({
              provider: "google",
              callbackURL: "/",
            })
          }
        >
          Continue with Google
        </Button>
      )}
    </main>
  );
}
