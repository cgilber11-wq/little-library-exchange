import Link from "next/link";
import { WishClaimButton } from "./wish-claim-button";

type WishRow = {
  id: string;
  title: string;
  author: string | null;
  status: string;
  responder: { name: string | null } | null;
  matchedUserBook: {
    id: string;
    status: string;
    book: { title: string };
    claim: { id: string } | null;
  } | null;
};

export function LookingForSection({ wishes }: { wishes: WishRow[] }) {
  const openWishes = wishes.filter((w) => w.status === "open");
  const matchedReady = wishes.filter(
    (w) => w.status === "matched" && w.matchedUserBook?.status === "available" && !w.matchedUserBook.claim,
  );
  const matchedOther = wishes.filter(
    (w) => w.status === "matched" && !matchedReady.some((r) => r.id === w.id),
  );

  if (wishes.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Nothing posted yet.{" "}
        <Link href="/search?tab=looking" className="font-medium text-emerald-700 hover:underline">
          Post what you&apos;re looking for
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {matchedReady.length > 0 ? (
        <ul className="space-y-2">
          {matchedReady.map((w) => (
            <li key={w.id} className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="font-medium text-stone-900">{w.title}</p>
              <p className="text-sm text-stone-600">
                {w.responder?.name || "A neighbor"} listed a copy.
              </p>
              {w.matchedUserBook ? <WishClaimButton userBookId={w.matchedUserBook.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {openWishes.length > 0 ? (
        <ul className="space-y-1.5">
          {openWishes.map((w) => (
            <li key={w.id} className="flex items-baseline gap-2 text-sm">
              <span className="font-medium text-stone-900">{w.title}</span>
              {w.author ? <span className="truncate text-stone-500">{w.author}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {matchedOther.length > 0 ? (
        <p className="text-xs text-stone-500">
          {matchedOther.length} earlier match{matchedOther.length === 1 ? "" : "es"}
        </p>
      ) : null}

      <p className="text-xs">
        <Link href="/search?tab=looking" className="font-medium text-emerald-700 hover:underline">
          Manage →
        </Link>
      </p>
    </div>
  );
}
