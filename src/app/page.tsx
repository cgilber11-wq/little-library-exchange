import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="page-shell">
      <AppHeader current={null} authenticated={!!session} />

      <main className="page-main max-w-2xl">
        <div className="cozy-card p-8 sm:p-10">
          <h1 className="page-title">Find and share books through little libraries</h1>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            List what you have, search what neighbors are sharing, and reserve pickups through community libraries.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {!session ? (
              <>
                <Link href="/register" className="btn-primary">
                  Create account
                </Link>
                <Link href="/login" className="btn-secondary">
                  Sign in
                </Link>
              </>
            ) : (
              <Link href="/dashboard" className="btn-primary">
                Dashboard
              </Link>
            )}
            <Link href="/about" className="btn-secondary">
              How it works
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
