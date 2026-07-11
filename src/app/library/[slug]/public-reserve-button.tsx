"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASK_TO_PLACE_LABEL } from "@/lib/listing-availability";

type Props = {
  userBookId: string;
  librarySlug: string;
  ownerUserId: string;
  canReserve: boolean;
};

export function PublicReserveButton({ userBookId, librarySlug, ownerUserId, canReserve }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const callbackUrl = `/library/${librarySlug}`;

  if (!canReserve) {
    return <span className="text-xs font-medium text-stone-500">Reserved</span>;
  }

  if (status === "loading") {
    return <span className="text-xs text-stone-400">…</span>;
  }

  if (!session?.user?.id) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Sign in to ask
      </Link>
    );
  }

  if (session.user.id === ownerUserId) {
    return (
      <Link href="/dashboard" className="text-xs font-medium text-emerald-700 hover:underline">
        Your listing
      </Link>
    );
  }

  if (done) {
    return (
      <Link href="/dashboard#pickups-out" className="text-xs font-medium text-emerald-700 hover:underline">
        Reserved — view pickup →
      </Link>
    );
  }

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

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onReserve}
        disabled={loading}
        className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? "Sending…" : ASK_TO_PLACE_LABEL}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
