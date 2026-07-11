import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { CollectionBookRow, LittleLibraryBookRow } from "../inventory-actions";
import { LibraryInventoryTabs } from "../library-inventory-tabs";
import { VerifyLibraryButton } from "../verify-library-button";

export default async function MyBooksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [userBooks, location] = await Promise.all([
    prisma.userBook.findMany({
      where: { userId: session.user.id },
      include: {
        book: true,
        wishFulfilled: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.location.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  const activeInCollection = userBooks.filter((ub) => ub.status === "available" || ub.status === "claimed");
  const littleLibraryBooks = activeInCollection.filter((ub) => ub.locationType === "my_library");
  const collectionOnlyBooks = activeInCollection.filter((ub) => ub.locationType !== "my_library");
  const libraryLastVerified = location?.libraryLastVerifiedAt
    ? formatVerifiedDate(location.libraryLastVerifiedAt)
    : null;

  function mapBookRow(ub: (typeof userBooks)[number]) {
    return {
      id: ub.id,
      status: ub.status,
      removedAt: ub.removedAt,
      createdAt: ub.createdAt,
      libraryPlacedAt: ub.libraryPlacedAt,
      book: ub.book,
      locationType: ub.locationType,
      dropLabel: ub.dropLabel,
      wishForRequesterName: ub.wishFulfilled?.user?.name ?? null,
    };
  }

  return (
    <div className="page-shell">
      <AppHeader current="books" />

      <main className="page-main max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title text-2xl sm:text-3xl">My books</h1>
            <p className="mt-2 max-w-xl text-sm text-stone-600">
              Shelf = in your little library. Collection = everything you track — move books to the shelf when
              neighbors can pick them up.
            </p>
          </div>
          <Link href="/dashboard/add" className="btn-primary shrink-0 gap-1.5 !px-4">
            <span aria-hidden className="text-base leading-none">+</span> Add book
          </Link>
        </div>

        <LibraryInventoryTabs
            tabs={[
              {
                id: "little-library",
                label: "Shelf",
                badge: littleLibraryBooks.length > 0 ? littleLibraryBooks.length : undefined,
                content: (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                      <p className="text-xs text-stone-500">
                        {libraryLastVerified ? (
                          <>Last verified {libraryLastVerified}</>
                        ) : (
                          <>Not verified yet</>
                        )}
                      </p>
                      <VerifyLibraryButton />
                    </div>

                    {littleLibraryBooks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center">
                        <p className="text-stone-600 text-sm mb-3">No books on your shelf yet.</p>
                        <Link href="/dashboard/add" className="btn-primary inline-flex">
                          Add book
                        </Link>
                      </div>
                    ) : (
                      <ul className="grid gap-3 lg:grid-cols-2">
                        {littleLibraryBooks.map((ub) => (
                          <LittleLibraryBookRow key={ub.id} ub={mapBookRow(ub)} />
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              },
              {
                id: "collection",
                label: "Collection",
                badge: collectionOnlyBooks.length > 0 ? collectionOnlyBooks.length : undefined,
                content: (
                  <div className="space-y-4">
                    {activeInCollection.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center">
                        <p className="mb-3 text-sm text-stone-600">No books yet.</p>
                        <Link href="/dashboard/add" className="btn-primary inline-flex">
                          Add book
                        </Link>
                      </div>
                    ) : (
                      <ul className="grid gap-3 lg:grid-cols-2">
                        {activeInCollection.map((ub) => (
                          <CollectionBookRow key={ub.id} ub={mapBookRow(ub)} />
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              },
            ]}
          />
      </main>
    </div>
  );
}

function formatVerifiedDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}
