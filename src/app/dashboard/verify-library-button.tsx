"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyLibraryButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function verify() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_library" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not save verification. Try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save verification. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={verify}
        disabled={loading}
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
      >
        {loading ? "Saving…" : saved ? "Saved!" : "I checked my library"}
      </button>
      {error ? <p className="max-w-[14rem] text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
