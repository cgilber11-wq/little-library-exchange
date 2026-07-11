"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BookRow = {
  id: string;
  status: string;
  removedAt: string | Date | null;
  createdAt: string | Date;
  libraryPlacedAt: string | Date | null;
  book: { title: string; author: string | null; coverUrl: string | null };
  locationType: string;
  dropLabel: string | null;
  wishForRequesterName?: string | null;
};

function formatDurationSince(d: Date | string) {
  const then = new Date(d).getTime();
  const days = Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

function StatusBadge({ status }: { status: string }) {
  const reserved = status === "claimed";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        reserved ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", reserved ? "bg-amber-500" : "bg-emerald-500"].join(" ")} aria-hidden />
      {reserved ? "Reserved" : "Available"}
    </span>
  );
}

function BookCover({ book }: { book: BookRow["book"] }) {
  if (book.coverUrl) {
    return <img src={book.coverUrl} alt={book.title} className="h-16 w-12 shrink-0 rounded object-cover" />;
  }
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-stone-100 text-stone-400">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A1.5 1.5 0 015.5 4H18a2 2 0 012 2v13a1 1 0 01-1 1H6a2 2 0 01-2-2V5.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v16" />
      </svg>
    </div>
  );
}

export function LittleLibraryBookRow({ ub }: { ub: BookRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placedAt = ub.libraryPlacedAt ?? ub.createdAt;

  async function removeFromLittleLibrary() {
    if (
      !confirm(
        `Remove “${ub.book.title}” from your little library? It will stay in your book collection so you can re-shelve it later.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-books/${ub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_from_little_library" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update book");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update book");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex gap-3">
        <BookCover book={ub.book} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-medium text-stone-900">{ub.book.title}</p>
            <StatusBadge status={ub.status} />
          </div>
          <p className="truncate text-sm text-stone-600">{ub.book.author ?? "—"}</p>
          <p className="mt-1 text-xs text-stone-500">
            On your shelf · <span className="font-medium text-stone-600">{formatDurationSince(placedAt)}</span>
          </p>
          {ub.wishForRequesterName ? (
            <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              Listed for {ub.wishForRequesterName}
            </span>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {ub.status === "available" && (
        <div className="flex justify-end border-t border-stone-100 pt-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={removeFromLittleLibrary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-50"
          >
            {loading ? "Removing…" : "Remove from shelf"}
          </button>
        </div>
      )}
    </li>
  );
}

export function CollectionBookRow({ ub }: { ub: BookRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onShelf = ub.locationType === "my_library";

  async function runAction(
    action: "add_to_little_library" | "remove_from_little_library" | "remove_from_collection",
  ) {
    const messages: Record<typeof action, string> = {
      add_to_little_library: `Add “${ub.book.title}” to your little library? Neighbors will be able to find and pick it up.`,
      remove_from_little_library: `Take “${ub.book.title}” off your shelf? It stays in your collection.`,
      remove_from_collection: `Remove “${ub.book.title}” from your collection entirely? You can always add it again later.`,
    };
    if (!confirm(messages[action])) return;

    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/user-books/${ub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update book");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update book");
    } finally {
      setLoading(null);
    }
  }

  const locationPill = onShelf ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
      On shelf
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
      Collection
    </span>
  );

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex gap-3">
        <BookCover book={ub.book} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-medium text-stone-900">{ub.book.title}</p>
            <StatusBadge status={ub.status} />
          </div>
          <p className="truncate text-sm text-stone-600">{ub.book.author ?? "—"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{locationPill}</div>
          {ub.wishForRequesterName ? (
            <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              Listed for {ub.wishForRequesterName}
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {ub.status === "available" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
          {onShelf ? (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => runAction("remove_from_little_library")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50"
            >
              {loading === "remove_from_little_library" ? "Updating…" : "Take off shelf"}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => runAction("add_to_little_library")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <span aria-hidden className="text-sm leading-none">+</span>
              {loading === "add_to_little_library" ? "Adding…" : "Add to shelf"}
            </button>
          )}
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => runAction("remove_from_collection")}
            className="text-xs font-medium text-stone-400 transition hover:text-red-600 disabled:opacity-50"
          >
            {loading === "remove_from_collection" ? "Removing…" : "Remove from collection"}
          </button>
        </div>
      )}
    </li>
  );
}
