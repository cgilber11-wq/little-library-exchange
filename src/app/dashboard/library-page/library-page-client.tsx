"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LIBRARY_PHOTO_ACCEPT, LIBRARY_PHOTO_MAX_BYTES } from "@/lib/library-photo-constants";
import { LibraryProfilePhoto } from "@/components/LibraryProfilePhoto";

type LibraryPageSettings = {
  publicSlug: string | null;
  publicUrl: string | null;
  publicPageEnabled: boolean;
  shareCollectionOnPublicPage: boolean;
  label: string | null;
  photoUrl: string | null;
};

function applyLocationJson(json: Record<string, unknown>): LibraryPageSettings {
  return {
    publicSlug: (json.publicSlug as string | null) ?? null,
    publicUrl: (json.publicUrl as string | null) ?? null,
    publicPageEnabled: json.publicPageEnabled !== false,
    shareCollectionOnPublicPage: json.shareCollectionOnPublicPage !== false,
    label: (json.label as string | null) ?? null,
    photoUrl: (json.photoUrl as string | null) ?? null,
  };
}

export function LibraryPageClient() {
  const [data, setData] = useState<LibraryPageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/location");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(applyLocationJson(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(patch: Partial<Pick<LibraryPageSettings, "publicPageEnabled" | "shareCollectionOnPublicPage">>) {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setData(applyLocationJson(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setPhotoBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/library-page/photo", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload photo");
      setData(applyLocationJson(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload photo");
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!data?.photoUrl) return;
    if (!confirm("Remove this photo from your library profile?")) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/library-page/photo", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove photo");
      setData(applyLocationJson(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function copyUrl() {
    if (!data?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(data.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  }

  if (loading) {
    return <p className="text-sm text-stone-500">Loading…</p>;
  }

  if (!data?.publicUrl) {
    const hasLocation = Boolean(data?.label);
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center">
        <p className="text-sm text-stone-600 mb-3">
          {hasLocation
            ? "Could not load your public link."
            : "Add a location first."}
        </p>
        <Link
          href="/dashboard/location"
          className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {hasLocation ? "Open location" : "Add location"}
        </Link>
        {hasLocation ? (
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 block w-full text-center text-xs font-medium text-emerald-700 hover:underline"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const previewHref = `/library/${data.publicSlug}`;
  const maxMb = Math.round(LIBRARY_PHOTO_MAX_BYTES / (1024 * 1024));

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="cozy-card p-4 sm:p-5">
        <h2 className="font-serif text-sm font-semibold text-stone-900">Profile picture</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="mx-auto w-full max-w-xs shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 sm:mx-0">
            {data.photoUrl ? (
              <LibraryProfilePhoto
                src={data.photoUrl}
                alt={data.label ? `Profile picture of ${data.label}` : "Little library profile picture"}
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center text-stone-300">
                <span className="text-3xl" aria-hidden>
                  📚
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={LIBRARY_PHOTO_ACCEPT}
              className="sr-only"
              disabled={photoBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50"
            >
              {photoBusy ? "Saving…" : data.photoUrl ? "Replace picture" : "Add picture"}
            </button>
            {data.photoUrl ? (
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => void removePhoto()}
                className="btn-secondary !px-4 !py-2 text-xs disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
            <p className="w-full text-xs text-stone-500">JPEG, PNG, or WebP · up to {maxMb} MB</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-xl border border-stone-100 bg-white p-3 shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/library-page/qr"
            alt="QR code linking to your public library page"
            width={200}
            height={200}
            className="h-[200px] w-[200px]"
          />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm font-medium text-stone-900">QR code</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <code className="max-w-full truncate rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-800">
              {data.publicUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href="/api/library-page/qr"
              download="little-library-qr.png"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
            >
              Download QR
            </a>
            <Link
              href={previewHref}
              target="_blank"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Preview ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-900">Settings</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={data.publicPageEnabled}
            disabled={saving}
            onChange={(e) => void saveSettings({ publicPageEnabled: e.target.checked })}
            className="mt-1 rounded border-stone-300"
          />
          <span className="text-sm text-stone-700">Public profile enabled</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={data.shareCollectionOnPublicPage}
            disabled={saving}
            onChange={(e) => void saveSettings({ shareCollectionOnPublicPage: e.target.checked })}
            className="mt-1 rounded border-stone-300"
          />
          <span className="text-sm text-stone-700">Show collection books on profile</span>
        </label>
      </div>
    </div>
  );
}
