"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { AppHeader } from "@/components/AppHeader";

export default function LocationPage() {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/location")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((loc) => {
        if (!loc) return;
        if (loc?.label) setLabel(loc.label);
        if (loc?.address) setAddress(loc.address);
        if (loc?.lat != null) setLat(loc.lat);
        if (loc?.lng != null) setLng(loc.lng);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/location", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label || undefined,
          address: address || undefined,
          lat: lat ?? undefined,
          lng: lng ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Failed to save location");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <AppHeader back={{ href: "/dashboard/settings", label: "Settings" }} />
        <main className="page-main max-w-2xl">
          <p className="text-sm text-stone-500">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <AppHeader back={{ href: "/dashboard/settings", label: "Settings" }} />

      <main className="page-main max-w-2xl">
        <h1 className="page-title text-2xl sm:text-3xl">Location</h1>
        <p className="mt-2 mb-6 text-sm text-stone-600">Used for distance search and your public profile.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div>
            <label htmlFor="label" className="mb-1 block text-sm font-medium text-stone-700">
              Label (e.g. “My little library – 123 Oak St”)
            </label>
            <input
              id="label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-stone-700">
              Address (pick a suggestion to save map coordinates)
            </label>
            <AddressAutocomplete
              id="address"
              value={address}
              onChange={setAddress}
              onSelectCoords={(latitude, longitude) => {
                setLat(latitude);
                setLng(longitude);
              }}
              placeholder="Start typing an address…"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save location"}
          </button>
        </form>
      </main>
    </div>
  );
}
