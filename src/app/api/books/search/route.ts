import { NextResponse } from "next/server";

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 502 });
    }

    const data = await res.json();
    const docs: OpenLibraryDoc[] = Array.isArray(data?.docs) ? data.docs : [];
    const results = docs
      .filter((d) => d.title)
      .map((d) => {
        const isbn = d.isbn?.find((code) => code?.length === 13 || code?.length === 10) ?? null;
        return {
          isbn,
          title: d.title!,
          author: d.author_name?.[0] ?? null,
          coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
        };
      });

    return NextResponse.json({ results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
