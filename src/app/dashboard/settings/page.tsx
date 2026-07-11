import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="page-shell">
      <AppHeader current="settings" back={{ href: "/dashboard", label: "Dashboard" }} />

      <main className="page-main max-w-2xl">
        <h1 className="page-title text-2xl sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-stone-600">Pickup and return windows for new reservations.</p>
        <div className="mt-6">
          <SettingsClient />
        </div>
      </main>
    </div>
  );
}
