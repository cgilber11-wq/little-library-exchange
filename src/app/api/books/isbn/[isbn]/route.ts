import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ isbn: string }> }
) {
  const isbn = (await params).isbn?.replace(/\D/g, "");
  if (!isbn) return NextResponse.json({ error: "ISBN required" }, { status: 400 });
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    const data = await res.json();
    const title = data.title ?? "Unknown";
    const authorKey = data.authors?.[0]?.key;
    let author = "";
    if (authorKey) {
      const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`, {
        next: { revalidate: 3600 },
      });
      if (authorRes.ok) {
        const authorData = await authorRes.json();
        author = authorData.name ?? "";
      }
    }
    const coverId = data.covers?.[0];
    const coverUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : null;
    return NextResponse.json({
      isbn,
      title,
      author: author || null,
      coverUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
