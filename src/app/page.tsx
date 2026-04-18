import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function RootPage() {
  // TODO: replace with Better Auth session check when auth is wired up
  const cookieStore = cookies();
  const session = cookieStore.get("nc_session");
  const onboarded = cookieStore.get("nc_onboarded");

  if (session && onboarded) {
    redirect("/dashboard");
  }

  redirect("/onboarding");
}
