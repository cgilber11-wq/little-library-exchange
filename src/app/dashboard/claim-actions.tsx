"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPickupSpot } from "@/lib/maps";

type LibraryProfileLocation = {
  publicSlug: string | null;
  publicPageEnabled: boolean;
  label: string | null;
};

type ClaimBase = {
  id: string;
  status: string;
  expiresAt: string | Date | null;
  returnBy: string | Date | null;
  userBook: {
    book: { title: string; author: string | null; coverUrl: string | null };
    locationType?: string;
  };
};
type ClaimReceived = ClaimBase & {
  claimer: {
    name: string | null;
    email: string;
    location: LibraryProfileLocation | null;
  };
};
type ClaimMade = ClaimBase & {
  owner: {
    name: string | null;
    location: (LibraryProfileLocation & {
      address: string | null;
      lat: number | null;
      lng: number | null;
    }) | null;
  };
  userBook: {
    book: { title: string; author: string | null; coverUrl: string | null };
    locationType: string;
    dropLabel: string | null;
    dropLat: number | null;
    dropLng: number | null;
  };
};

const ACTIVE_STATUSES = new Set(["pending", "book_placed"]);

function publicLibrarySlug(location: LibraryProfileLocation | null | undefined) {
  if (!location?.publicSlug || location.publicPageEnabled === false) return null;
  return location.publicSlug;
}

function partitionClaims<T extends { status: string }>(claims: T[]) {
  const active: T[] = [];
  const past: T[] = [];
  for (const c of claims) {
    if (ACTIVE_STATUSES.has(c.status)) active.push(c);
    else past.push(c);
  }
  return { active, past };
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function PickupLocationRow({ claim, status }: { claim: ClaimMade; status: string }) {
  const spot = getPickupSpot(claim.userBook, claim.owner.location);
  const profileSlug = publicLibrarySlug(claim.owner.location);
  const displayName = spot.label || "Pickup location";

  if (!spot.label && !spot.directionsUrl && !profileSlug) return null;

  const prefix = status === "book_placed" ? "Pick up at" : "Pickup:";
  const nameLinkClass =
    "font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950";

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="inline-flex min-w-0 items-start gap-1 text-stone-600">
        <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span className="min-w-0">
          {prefix}{" "}
          {profileSlug ? (
            <Link href={`/library/${profileSlug}`} target="_blank" className={nameLinkClass}>
              {displayName}
            </Link>
          ) : (
            <span className="font-medium text-stone-800">{displayName}</span>
          )}
        </span>
      </span>
      {spot.directionsUrl ? (
        <a
          href={spot.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 hover:bg-emerald-100"
        >
          Directions
          <span aria-hidden>↗</span>
        </a>
      ) : null}
    </div>
  );
}

function formatDue(iso: string | Date | null | undefined) {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function humanStatus(status: string, role: "owner" | "picker", locationType?: string) {
  const fromCollection = locationType === "collection";
  switch (status) {
    case "pending":
      if (role === "owner") {
        return fromCollection
          ? "Arrange pickup (from your collection)"
          : "Place the book on your shelf";
      }
      return fromCollection
        ? "Waiting for owner to arrange pickup"
        : "Waiting for owner to place the book";
    case "book_placed":
      return role === "picker" ? "Ready for pickup" : "Waiting for pickup";
    case "completed":
      return "Exchange complete";
    case "expired":
      return "Reservation expired";
    default:
      return status.replace(/_/g, " ");
  }
}

function PastClaimsToggle({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-700">
        Past ({count})
      </summary>
      <ul className="mt-2 space-y-2 border-t border-stone-100 pt-2">{children}</ul>
    </details>
  );
}

function PastClaimRow({
  title,
  status,
  meta,
}: {
  title: string;
  status: string;
  meta?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-stone-50/80 px-3 py-2 text-sm">
      <span className="min-w-0 truncate font-medium text-stone-700">{title}</span>
      <span className="shrink-0 text-xs text-stone-500">
        {status === "completed" ? "Completed" : "Expired"}
        {meta ? ` · ${meta}` : ""}
      </span>
    </li>
  );
}

export function ClaimsReceived({ claims }: { claims: ClaimReceived[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { active, past } = partitionClaims(claims);

  async function markPlaced(claimId: string) {
    setLoadingId(claimId);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "book_placed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update reservation");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update reservation");
    } finally {
      setLoadingId(null);
    }
  }

  if (claims.length === 0) {
    return <p className="text-sm text-stone-500">No reservations yet.</p>;
  }

  return (
    <>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      {active.length === 0 ? (
        <p className="text-sm text-stone-500">All caught up.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 sm:flex-nowrap"
            >
              {c.userBook.book.coverUrl ? (
                <img
                  src={c.userBook.book.coverUrl}
                  alt={c.userBook.book.title}
                  className="h-16 w-12 shrink-0 rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{c.userBook.book.title}</p>
                <p className="text-sm text-stone-600">{c.claimer.name || c.claimer.email}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {humanStatus(c.status, "owner", c.userBook.locationType)}
                  {c.expiresAt ? <> · Pickup by {formatDue(c.expiresAt)}</> : null}
                </p>
              </div>
              {c.status === "pending" ? (
                <button
                  type="button"
                  disabled={!!loadingId}
                  onClick={() => markPlaced(c.id)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loadingId === c.id
                    ? "…"
                    : c.userBook.locationType === "collection"
                      ? "Mark ready"
                      : "Mark placed"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <PastClaimsToggle count={past.length}>
        {past.map((c) => (
          <PastClaimRow
            key={c.id}
            title={c.userBook.book.title}
            status={c.status}
            meta={c.status === "completed" && c.returnBy ? `return by ${formatDue(c.returnBy)}` : undefined}
          />
        ))}
      </PastClaimsToggle>
    </>
  );
}

export function ClaimsMade({ claims }: { claims: ClaimMade[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { active, past } = partitionClaims(claims);

  async function markPickedUp(claimId: string) {
    setLoadingId(claimId);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "picked_up" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not confirm pickup");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not confirm pickup");
    } finally {
      setLoadingId(null);
    }
  }

  if (claims.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No pickups yet.{" "}
        <Link href="/search" className="font-medium text-emerald-700 hover:underline">
          Find a book
        </Link>
      </p>
    );
  }

  return (
    <>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      {active.length === 0 ? (
        <p className="text-sm text-stone-500">All caught up.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-100 bg-stone-50/60 p-3 sm:flex-nowrap"
            >
              {c.userBook.book.coverUrl ? (
                <img
                  src={c.userBook.book.coverUrl}
                  alt={c.userBook.book.title}
                  className="h-16 w-12 shrink-0 rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900">{c.userBook.book.title}</p>
                <p className="text-sm text-stone-600">From {c.owner.name || "a neighbor"}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {humanStatus(c.status, "picker", c.userBook.locationType)}
                  {c.expiresAt ? <> · Pick up by {formatDue(c.expiresAt)}</> : null}
                </p>
                {(c.status === "pending" || c.status === "book_placed") && (
                  <PickupLocationRow claim={c} status={c.status} />
                )}
              </div>
              {c.status === "book_placed" ? (
                <button
                  type="button"
                  disabled={!!loadingId}
                  onClick={() => markPickedUp(c.id)}
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loadingId === c.id ? "…" : "I picked it up"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <PastClaimsToggle count={past.length}>
        {past.map((c) => (
          <PastClaimRow
            key={c.id}
            title={c.userBook.book.title}
            status={c.status}
            meta={c.status === "completed" && c.returnBy ? `return by ${formatDue(c.returnBy)}` : undefined}
          />
        ))}
      </PastClaimsToggle>
    </>
  );
}
