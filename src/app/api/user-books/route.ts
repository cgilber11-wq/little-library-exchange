import { NextResponse } from "next/server";
import type { Book } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userBooks = await prisma.userBook.findMany({
    where: { userId: session.user.id },
    include: { book: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(userBooks);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      isbn,
      title,
      author,
      coverUrl,
      locationType,
      bookCopyId,
    } = body;

    const allowedLocationTypes = ["my_library", "collection"] as const;
    const resolvedLocationType =
      typeof locationType === "string" && allowedLocationTypes.includes(locationType as (typeof allowedLocationTypes)[number])
        ? locationType
        : "my_library";

    let book: Book;
    let copyId: string;

    if (bookCopyId && typeof bookCopyId === "string") {
      const copy = await prisma.bookCopy.findUnique({
        where: { id: bookCopyId },
        include: {
          book: true,
          shareEvents: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!copy) return NextResponse.json({ error: "Unknown book copy" }, { status: 400 });
      const last = copy.shareEvents[0];
      if (!last || last.toUserId !== session.user.id) {
        return NextResponse.json({ error: "You are not the current holder of this copy" }, { status: 403 });
      }
      const active = await prisma.userBook.findFirst({
        where: {
          bookCopyId: copy.id,
          status: { in: ["available", "claimed"] },
        },
      });
      if (active) {
        return NextResponse.json({ error: "This copy is already listed" }, { status: 400 });
      }
      book = copy.book;
      copyId = copy.id;
    } else {
      if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
      let found = await prisma.book.findFirst({
        where: isbn ? { isbn } : { title, author: author ?? null },
      });
      if (!found) {
        found = await prisma.book.create({
          data: {
            isbn: isbn || null,
            title,
            author: author ?? null,
            coverUrl: coverUrl ?? null,
          },
        });
      }
      book = found;
      const copy = await prisma.bookCopy.create({
        data: {
          bookId: book.id,
          originalOwnerId: session.user.id,
        },
      });
      copyId = copy.id;
    }

    const userBook = await prisma.userBook.create({
      data: {
        userId: session.user.id,
        bookId: book.id,
        bookCopyId: copyId,
        locationType: resolvedLocationType,
        libraryPlacedAt: resolvedLocationType === "my_library" ? new Date() : null,
      },
      include: { book: true, bookCopy: true },
    });
    return NextResponse.json(userBook);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to add book" }, { status: 500 });
  }
}
