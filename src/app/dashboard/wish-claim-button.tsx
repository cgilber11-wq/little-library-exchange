"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASK_TO_PLACE_LABEL } from "@/lib/listing-availability";

/** Requester reserves a listing created when someone tapped “I have that!” on their wish. */
export function WishClaimButton({ userBookId }: { userBookId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onReserve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userBookId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not reserve");
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Link href="/dashboard#pickups-out" className="mt-2 inline-block text-xs font-medium text-emerald-700 hover:underline">
        Reserved — view pickup →
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onReserve}
        disabled={loading}
        className="mt-2 inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Sending…" : ASK_TO_PLACE_LABEL}
      </button>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
