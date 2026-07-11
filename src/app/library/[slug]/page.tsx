import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LibraryProfilePhoto } from "@/components/LibraryProfilePhoto";
import { getPublicLibraryBySlug } from "@/lib/library-public";
import { prisma } from "@/lib/prisma";
import { PublicReserveButton } from "./public-reserve-button";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const library = await getPublicLibraryBySlug(params.slug);
  if (!library) return { title: "Library not found" };
  const title = library.label?.trim() || "Little library";
  return {
    title: `${title} · Little Library Exchange`,
    description: `Browse books at ${title} — on the shelf and available from the steward's collection.`,
  };
}

export default async function PublicLibraryPage({ params }: Props) {
  const library = await getPublicLibraryBySlug(params.slug);
  if (!library) notFound();

  const owner = await prisma.location.findFirst({
    where: { publicSlug: params.slug },
    select: { userId: true },
  });
  const ownerUserId = owner?.userId ?? "";

  const displayName = library.label?.trim() || library.address?.trim() || "Little library";
  const verifiedLine = library.libraryLastVerifiedAt
    ? new Date(library.libraryLastVerifiedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <div className="page-shell">
      <header className="app-header">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-4">
          <Brand href="/" className="text-sm font-semibold text-stone-800" />
          <Link href="/about" className="text-xs font-medium text-emerald-700 hover:underline">
            About
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {library.photoUrl ? (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
            <LibraryProfilePhoto src={library.photoUrl} alt={displayName} />
          </div>
        ) : null}

        <h1 className={`font-serif text-2xl font-semibold text-stone-900 ${library.photoUrl ? "mt-6" : ""}`}>{displayName}</h1>
        {library.stewardName ? (
          <p className="mt-1 text-sm text-stone-600">
            {library.stewardName}
            {library.exchangeCount > 0 ? (
              <span className="text-stone-400"> · {library.exchangeCount} exchanges</span>
            ) : null}
          </p>
        ) : null}
        {library.address && library.address !== displayName ? (
          <p className="mt-1 text-sm text-stone-500">{library.address}</p>
        ) : null}
        {verifiedLine ? (
          <p className="mt-2 text-xs text-stone-500">Shelf checked {verifiedLine}</p>
        ) : (
          <p className="mt-2 text-xs text-stone-500">Shelf may have changed</p>
        )}

        <LibrarySection
          title="On the shelf"
          books={library.onShelf}
          librarySlug={library.slug}
          ownerUserId={ownerUserId}
          emptyMessage="Nothing on the shelf right now."
        />

        {library.shareCollectionOnPublicPage ? (
          <LibrarySection
            title="Collection"
            books={library.fromCollection}
            librarySlug={library.slug}
            ownerUserId={ownerUserId}
            emptyMessage="No collection books listed."
          />
        ) : null}

        <p className="mt-10 text-center text-sm text-stone-600">
          <Link href="/register" className="font-medium text-emerald-700 hover:underline">
            Join free
          </Link>{" "}
          to list your books
        </p>
      </main>
    </div>
  );
}

function LibrarySection({
  title,
  books,
  librarySlug,
  ownerUserId,
  emptyMessage,
}: {
  title: string;
  books: { id: string; status: string; book: { title: string; author: string | null; coverUrl: string | null } }[];
  librarySlug: string;
  ownerUserId: string;
  emptyMessage: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {books.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {books.map((ub) => (
            <li
              key={ub.id}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
            >
              {ub.book.coverUrl ? (
                <img src={ub.book.coverUrl} alt="" className="h-16 w-12 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-stone-100 text-stone-400 text-xs">
                  Book
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900 truncate">{ub.book.title}</p>
                <p className="text-sm text-stone-600 truncate">{ub.book.author ?? "—"}</p>
              </div>
              <PublicReserveButton
                userBookId={ub.id}
                librarySlug={librarySlug}
                ownerUserId={ownerUserId}
                canReserve={ub.status === "available"}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
