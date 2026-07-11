import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";

export default async function IntroducedBooksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const myOriginalCopies = await prisma.bookCopy.findMany({
    where: { originalOwnerId: session.user.id },
    include: {
      book: true,
      _count: { select: { shareEvents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const sortedByExchanges = [...myOriginalCopies].sort(
    (a, b) => b._count.shareEvents - a._count.shareEvents,
  );

  return (
    <div className="page-shell">
      <AppHeader current="dashboard" back={{ href: "/dashboard", label: "Dashboard" }} />

      <main className="page-main max-w-4xl">
        <h1 className="page-title text-2xl sm:text-3xl">Introduced</h1>
        <p className="mt-2 text-sm text-stone-600">Copies you first listed and how far they&apos;ve traveled.</p>

        {myOriginalCopies.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-center">
            <p className="mb-3 text-sm text-stone-600">No introduced copies yet.</p>
            <Link href="/dashboard/add" className="btn-primary inline-flex">
              Add book
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
            {sortedByExchanges.map((copy) => (
              <li key={copy.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 truncate">{copy.book.title}</p>
                  {copy.book.author ? (
                    <p className="text-xs text-stone-500 truncate">{copy.book.author}</p>
                  ) : null}
                </div>
                <span className="shrink-0 tabular-nums text-stone-600">
                  {copy._count.shareEvents} exchange{copy._count.shareEvents === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
