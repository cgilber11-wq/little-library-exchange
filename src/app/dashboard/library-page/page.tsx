import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { LibraryPageClient } from "./library-page-client";

export default async function LibraryPageSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="page-shell">
      <AppHeader back={{ href: "/dashboard/settings", label: "Settings" }} />

      <main className="page-main max-w-2xl">
        <h1 className="page-title text-2xl sm:text-3xl">Library profile</h1>
        <p className="mt-2 text-sm text-stone-600">
          Public page and QR code.{" "}
          <Link href="/dashboard/location" className="font-medium text-emerald-700 hover:underline">
            Location
          </Link>{" "}
          sets the name and address.
        </p>
        <div className="mt-6">
          <LibraryPageClient />
        </div>
      </main>
    </div>
  );
}
