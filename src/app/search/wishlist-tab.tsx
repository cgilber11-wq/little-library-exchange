"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CommunityRow = {
  id: string;
  title: string;
  author: string | null;
  note: string | null;
  requester: { id: string; name: string | null; exchangeCount: number };
  distanceMiles: number | null;
};

type MineRow = {
  id: string;
  title: string;
  author: string | null;
  status: string;
  matchedUserBook: { id: string; book: { title: string } } | null;
  responder: { name: string | null } | null;
};

type Props = {
  maxMiles: string;
  useDeviceLocation: boolean;
  deviceLat: number | null;
  deviceLng: number | null;
};

const MAX_WISHES = 5;

export function WishlistTab({ maxMiles, useDeviceLocation, deviceLat, deviceLng }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [mine, setMine] = useState<MineRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [community, setCommunity] = useState<CommunityRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [modalWish, setModalWish] = useState<CommunityRow | null>(null);
  const [responding, setResponding] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const runIdRef = useRef(0);

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await fetch("/api/book-wish-requests/mine");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMine(data.requests ?? []);
      setOpenCount(data.openCount ?? 0);
    } catch {
      setMine([]);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  const loadCommunity = useCallback(async () => {
    const myRun = ++runIdRef.current;
    setLoadingFeed(true);
    try {
      const params = new URLSearchParams();
      if (maxMiles) params.set("maxMiles", maxMiles);
      if (useDeviceLocation && deviceLat != null && deviceLng != null) {
        params.set("lat", String(deviceLat));
        params.set("lng", String(deviceLng));
      }
      const res = await fetch(`/api/book-wish-requests?${params.toString()}`);
      const data = await res.json();
      if (myRun !== runIdRef.current) return;
      if (!res.ok) {
        setCommunity([]);
        setMessage({ type: "err", text: data.error || "Could not load posts." });
        return;
      }
      setCommunity(data.results ?? []);
    } catch {
      if (myRun !== runIdRef.current) return;
      setCommunity([]);
      setMessage({ type: "err", text: "Could not load posts." });
    } finally {
      if (myRun === runIdRef.current) setLoadingFeed(false);
    }
  }, [maxMiles, useDeviceLocation, deviceLat, deviceLng]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

  async function handleAddRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ type: "err", text: "Enter a title." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/book-wish-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not save." });
        return;
      }
      setTitle("");
      setAuthor("");
      setNote("");
      setShowPostForm(false);
      setMessage({ type: "ok", text: "Posted." });
      await loadMine();
      await loadCommunity();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(id: string) {
    if (!confirm("Remove this post?")) return;
    const res = await fetch(`/api/book-wish-requests/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "err", text: typeof data.error === "string" ? data.error : "Could not remove." });
      return;
    }
    await loadMine();
    await loadCommunity();
    router.refresh();
  }

  async function confirmRespond() {
    if (!modalWish) return;
    setResponding(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/book-wish-requests/${modalWish.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not add listing." });
        return;
      }
      setModalWish(null);
      setMessage({ type: "ok", text: "Added to your shelf." });
      await loadMine();
      await loadCommunity();
      router.refresh();
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-900">
            Your posts <span className="font-normal text-stone-500">({openCount}/{MAX_WISHES} open)</span>
          </h2>
          <button
            type="button"
            onClick={() => setShowPostForm(true)}
            disabled={openCount >= MAX_WISHES}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {openCount >= MAX_WISHES ? "Limit reached" : "+ Post"}
          </button>
        </div>

        {loadingMine ? (
          <p className="mt-3 text-sm text-stone-500">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Post a title you want — neighbors can offer a copy.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50/80 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 truncate">{w.title}</p>
                  {w.author && <p className="text-xs text-stone-600 truncate">{w.author}</p>}
                  {w.status === "matched" && (
                    <p className="mt-1 text-xs text-emerald-700">
                      {w.responder?.name || "Someone"} listed a copy.
                    </p>
                  )}
                </div>
                {w.status === "open" && (
                  <button type="button" onClick={() => cancelRequest(w.id)} className="shrink-0 text-xs text-stone-500 hover:text-red-700">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-stone-900 mb-2">
          Neighbors looking for books
          {!loadingFeed && <span className="font-normal text-stone-500"> · {community.length}</span>}
        </h2>

        {loadingFeed && community.length === 0 ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : community.length === 0 ? (
          <p className="text-sm text-stone-500">No open posts in range.</p>
        ) : (
          <ul className="space-y-2">
            {community.map((w) => (
              <li key={w.id} className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900">{w.title}</p>
                  {w.author && <p className="text-sm text-stone-600">{w.author}</p>}
                  {w.note && <p className="mt-1 text-xs text-stone-500">{w.note}</p>}
                  <p className="mt-1 text-xs text-stone-500">
                    {w.requester.name || "A neighbor"}
                    {w.distanceMiles != null && <> · {formatMi(w.distanceMiles)} mi</>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalWish(w)}
                  className="shrink-0 self-start rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  I have that!
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className={`p-3 rounded-lg text-sm ${message.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
        </p>
      )}

      {showPostForm && (
        <Modal title="Post a book you're looking for" onClose={() => !saving && setShowPostForm(false)}>
          <form onSubmit={handleAddRequest} className="space-y-3">
            <Field label="Title" value={title} onChange={setTitle} required placeholder="e.g. The Night Circus" />
            <Field label="Author" value={author} onChange={setAuthor} placeholder="Optional" />
            <Field label="Note" value={note} onChange={setNote} placeholder="Edition, format, etc." />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowPostForm(false)} disabled={saving} className="px-4 py-2 text-sm border border-stone-300 rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={saving || openCount >= MAX_WISHES} className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                {saving ? "Saving…" : "Post"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalWish && (
        <Modal title="Add to your shelf?" onClose={() => !responding && setModalWish(null)}>
          <p className="text-sm text-stone-600 mb-4">
            List <strong>{modalWish.title}</strong> on your little library so {modalWish.requester.name || "they"} can
            ask you to place it.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalWish(null)} disabled={responding} className="px-4 py-2 text-sm border border-stone-300 rounded-lg">
              Cancel
            </button>
            <button type="button" onClick={confirmRespond} disabled={responding} className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg disabled:opacity-50">
              {responding ? "Adding…" : "Add listing"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-stone-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-600">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2"
        placeholder={placeholder}
        maxLength={500}
        required={required}
        autoFocus={required}
      />
    </div>
  );
}

function formatMi(m: number) {
  return m < 10 ? m.toFixed(1) : String(Math.round(m));
}
