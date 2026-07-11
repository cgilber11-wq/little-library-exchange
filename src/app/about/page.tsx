import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "About · Little Library Exchange",
  description: "List books, search nearby, and complete exchanges through little free libraries.",
};

const STEPS = [
  { title: "List your books", body: "Add by ISBN or title. Tag each as on your shelf or in your collection." },
  { title: "Find a book", body: "Search by title or author and filter by distance." },
  { title: "Reserve and pick up", body: "Reserve a copy. The owner places it on their shelf or arranges pickup." },
  { title: "Track exchanges", body: "Completed pickups add to your exchange count." },
];

export default async function AboutPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="page-shell">
      <AppHeader current="about" authenticated={!!session} />

      <main className="page-main max-w-3xl">
        <h1 className="page-title">How it works</h1>
        <p className="mt-4 text-stone-600 leading-relaxed">
          Little Library Exchange is a searchable catalog of books neighbors are ready to share — on little library
          shelves and in home collections. Not a marketplace; just books moving through your community.
        </p>

        <ol className="mt-8 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="cozy-card flex gap-4 p-4 sm:p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h2 className="font-serif font-semibold text-stone-900">{step.title}</h2>
                <p className="mt-1 text-sm text-stone-600 leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {!session ? (
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Create account
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          </div>
        ) : (
          <div className="mt-10">
            <Link href="/dashboard" className="btn-primary">
              Dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
