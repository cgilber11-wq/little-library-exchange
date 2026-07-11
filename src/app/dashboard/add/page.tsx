"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

type BookCandidate = {
  isbn: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
};

type RelistRow = {
  bookCopyId: string;
  book: { title: string; author: string | null; coverUrl: string | null };
  handoffCount: number;
};

export default function AddBookPage() {
  const [mode, setMode] = useState<"isbn" | "text_search" | "relist">("isbn");
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);
  const [book, setBook] = useState<BookCandidate | null>(null);
  const [relistCopyId, setRelistCopyId] = useState<string | null>(null);
  const [relistable, setRelistable] = useState<RelistRow[]>([]);
  const [relistLoading, setRelistLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BookCandidate[]>([]);

  const [locationType, setLocationType] = useState<"my_library" | "collection">("my_library");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBook(null);
    const digits = isbn.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid ISBN (10 or 13 digits)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/books/isbn/${encodeURIComponent(digits)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setBook({
        isbn: data.isbn ?? null,
        title: data.title,
        author: data.author ?? null,
        coverUrl: data.coverUrl ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "text_search") return;
    if (searchText.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(searchText.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setSearchResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText, mode]);

  useEffect(() => {
    if (mode !== "relist") return;
    setRelistLoading(true);
    fetch("/api/book-copies/relistable")
      .then((r) => r.json())
      .then((d) => setRelistable(Array.isArray(d.copies) ? d.copies : []))
      .catch(() => setRelistable([]))
      .finally(() => setRelistLoading(false));
  }, [mode]);

  async function handleAdd() {
    if (!book) return;
    setError("");
    try {
      const res = await fetch("/api/user-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn: book.isbn ?? undefined,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          locationType,
          ...(relistCopyId ? { bookCopyId: relistCopyId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add");
      }
      router.push("/dashboard/books");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add book");
    }
  }

  return (
    <div className="page-shell">
      <AppHeader current="books" back={{ href: "/dashboard/books", label: "My Books" }} />

      <main className="page-main max-w-2xl">
        <h1 className="page-title mb-6 text-2xl sm:text-3xl">Add a book</h1>

        <div className="mb-6 border-b border-stone-200">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("isbn");
                setError("");
                setRelistCopyId(null);
              }}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                mode === "isbn"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              ISBN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("text_search");
                setError("");
                setRelistCopyId(null);
              }}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                mode === "text_search"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              Title search
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("relist");
                setError("");
                setBook(null);
                setRelistCopyId(null);
              }}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                mode === "relist"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              Relist a pickup
            </button>
          </div>
        </div>

        {mode === "isbn" && (
          <form onSubmit={handleLookup} className="mb-8">
            <label htmlFor="isbn" className="block text-sm font-medium text-stone-700 mb-2">
              ISBN
            </label>
            <p className="text-sm text-stone-600 mb-2">10 or 13 digits, or paste from a scanner app.</p>
            <div className="flex gap-2">
              <input
                id="isbn"
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="e.g. 9780451526535"
                className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Looking up..." : "Look up"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>
        )}

        {mode === "relist" && (
          <div className="mb-8">
            {relistLoading && <p className="text-stone-500 text-sm">Loading…</p>}
            {!relistLoading && relistable.length === 0 && (
              <p className="text-stone-500 text-sm">No copies ready to relist.</p>
            )}
            {!relistLoading && relistable.length > 0 && (
              <ul className="border border-stone-200 rounded-lg divide-y divide-stone-100 bg-white">
                {relistable.map((row) => (
                  <li key={row.bookCopyId}>
                    <button
                      type="button"
                      onClick={() => {
                        setRelistCopyId(row.bookCopyId);
                        setBook({
                          isbn: null,
                          title: row.book.title,
                          author: row.book.author,
                          coverUrl: row.book.coverUrl,
                        });
                        setError("");
                      }}
                      className="w-full text-left p-4 hover:bg-amber-50 flex gap-3"
                    >
                      {row.book.coverUrl && (
                        <img src={row.book.coverUrl} alt="" className="w-12 h-16 object-cover rounded shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-stone-900">{row.book.title}</p>
                        <p className="text-sm text-stone-600">{row.book.author ?? "—"}</p>
                        <p className="text-xs text-stone-500 mt-1">
                          {row.handoffCount} handoff{row.handoffCount === 1 ? "" : "s"} so far in this app
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === "text_search" && (
          <div className="mb-8">
            <label htmlFor="book-search" className="block text-sm font-medium text-stone-700 mb-2">
              Search by title or author
            </label>
            <input
              id="book-search"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Start typing a book name..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            {searchLoading && <p className="mt-2 text-sm text-stone-500">Searching...</p>}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {searchResults.length > 0 && (
              <ul className="mt-3 border border-stone-200 rounded-lg divide-y divide-stone-100 bg-white">
                {searchResults.map((result, idx) => (
                  <li key={`${result.title}-${result.author}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setBook(result);
                        setError("");
                      }}
                      className="w-full text-left p-3 hover:bg-amber-50"
                    >
                      <p className="font-medium text-stone-900">{result.title}</p>
                      <p className="text-sm text-stone-600">
                        {result.author ?? "Unknown author"}
                        {result.isbn ? ` - ISBN ${result.isbn}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {book && (
          <div className="border border-stone-200 rounded-lg p-6 bg-white">
            <div className="flex gap-4 mb-4">
              {book.coverUrl && (
                <img
                  src={book.coverUrl}
                  alt=""
                  className="w-24 h-36 object-cover rounded"
                />
              )}
              <div>
                <h2 className="font-semibold text-stone-900">{book.title}</h2>
                <p className="text-stone-600">{book.author ?? "Unknown author"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Where is this book?
                </label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as "my_library" | "collection")}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                >
                  <option value="my_library">On my shelf</option>
                  <option value="collection">In my collection</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
              >
                Add book
              </button>
              <button
                type="button"
                onClick={() => {
                  setBook(null);
                  setRelistCopyId(null);
                  setError("");
                }}
                className="px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
