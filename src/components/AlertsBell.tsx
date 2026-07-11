"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { AlertItem } from "@/lib/alerts";

const STORAGE_KEY = "lle-alert-seen-ids";
const MAX_SEEN = 250;

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.slice(-MAX_SEEN));
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  const arr = [...ids].slice(-MAX_SEEN);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function kindEmoji(kind: AlertItem["kind"]): string {
  switch (kind) {
    case "request":
      return "📬";
    case "placed":
      return "📍";
    case "pickup":
      return "📗";
    case "complete":
      return "✨";
    case "expired":
      return "⏱️";
    default:
      return "•";
  }
}

/**
 * Bell icon + dropdown of recent claim activity (signed-in users only).
 */
export function AlertsBell() {
  const { status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(loadSeen());
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) return;
      const data = (await res.json()) as { alerts: AlertItem[] };
      setAlerts(data.alerts ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, pathname]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const id = window.setInterval(fetchAlerts, 60_000);
    return () => window.clearInterval(id);
  }, [status, fetchAlerts]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function markAllSeen() {
    setSeen((prev) => {
      const next = new Set(prev);
      for (const a of alerts) next.add(a.id);
      saveSeen(next);
      return next;
    });
  }

  function onToggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllSeen();
  }

  if (status !== "authenticated") return null;

  const unread = alerts.filter((a) => !seen.has(a.id)).length;
  const badge = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;

  return (
    <div className="relative flex shrink-0 items-center" ref={wrapRef}>
      <button
        type="button"
        onClick={onToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/80 bg-white/90 text-stone-600 transition hover:border-emerald-300 hover:bg-emerald-50/80 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={badge ? `Alerts, ${unread} unread` : "Alerts"}
      >
        <BellIcon className="h-5 w-5" />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10"
          role="dialog"
          aria-label="Recent activity"
        >
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-stone-900">Activity</p>
          </div>
          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-500">Loading…</p>
            ) : alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-500">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className={[
                        "flex gap-3 px-4 py-3 text-left transition hover:bg-emerald-50/80",
                        a.urgent ? "bg-amber-50/60" : "",
                      ].join(" ")}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {kindEmoji(a.kind)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-stone-900">{a.title}</p>
                          <span className="shrink-0 text-[10px] text-stone-400">{formatRelative(a.at)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-600 leading-snug">{a.detail}</p>
                        {a.urgent ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Pickup window ending soon
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {pathname !== "/dashboard" ? (
            <div className="border-t border-stone-100 px-4 py-2">
              <Link
                href="/dashboard"
                className="text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                onClick={() => setOpen(false)}
              >
                Dashboard →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}
