import { NextResponse } from "next/server";
import { getPublicLibraryBySlug } from "@/lib/library-public";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const library = await getPublicLibraryBySlug(params.slug);
  if (!library) {
    return NextResponse.json({ error: "Library not found" }, { status: 404 });
  }
  return NextResponse.json({ library });
}
