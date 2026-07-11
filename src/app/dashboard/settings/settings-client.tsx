"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SettingsClient() {
  const router = useRouter();
  const [checkoutDays, setCheckoutDays] = useState(14);
  const [returnDays, setReturnDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (typeof d.bookCheckoutDays === "number") setCheckoutDays(d.bookCheckoutDays);
        if (typeof d.bookReturnDays === "number") setReturnDays(d.bookReturnDays);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookCheckoutDays: checkoutDays, bookReturnDays: returnDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
        <div>
          <label htmlFor="bookCheckoutDays" className="mb-1 block text-sm font-medium text-stone-700">
            Pickup window (days)
          </label>
          <input
            id="bookCheckoutDays"
            type="number"
            min={1}
            max={365}
            value={checkoutDays}
            onChange={(e) => setCheckoutDays(Number(e.target.value))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          />
          <p className="mt-1 text-xs text-stone-500">Days to complete pickup after a reservation.</p>
        </div>
        <div>
          <label htmlFor="bookReturnDays" className="mb-1 block text-sm font-medium text-stone-700">
            Return window (days)
          </label>
          <input
            id="bookReturnDays"
            type="number"
            min={1}
            max={365}
            value={returnDays}
            onChange={(e) => setReturnDays(Number(e.target.value))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          />
          <p className="mt-1 text-xs text-stone-500">Suggested return date shown after pickup.</p>
        </div>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      <div className="border-t border-stone-200 pt-6">
        <p className="text-sm font-medium text-stone-900">Also</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li>
            <Link href="/dashboard/location" className="font-medium text-emerald-700 hover:underline">
              Location
            </Link>
            <span className="text-stone-500"> — library address for search</span>
          </li>
          <li>
            <Link href="/dashboard/library-page" className="font-medium text-emerald-700 hover:underline">
              Library profile
            </Link>
            <span className="text-stone-500"> — photo, QR code, public page</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
