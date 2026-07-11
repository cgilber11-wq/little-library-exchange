import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Book } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureBookCopyForUserBook } from "@/lib/book-copy";

/**
 * POST: “I have that!” — add a listing for this book and link it to the wish.
 * Body: { confirm: true }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: wishId } = await params;

  let body: { confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: "confirm: true required" }, { status: 400 });
  }

  const wish = await prisma.bookWishRequest.findUnique({
    where: { id: wishId },
    include: { user: true },
  });

  if (!wish) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (wish.status !== "open") {
    return NextResponse.json({ error: "This request is no longer open." }, { status: 400 });
  }
  if (wish.userId === session.user.id) {
    return NextResponse.json({ error: "You can’t respond to your own request." }, { status: 400 });
  }

  const existingListing = await prisma.userBook.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["available", "claimed"] },
      book: { title: wish.title, author: wish.author ?? null },
    },
    include: { book: true },
  });

  if (existingListing) {
    return NextResponse.json(
      {
        error:
          "You already have an active listing for this title/author. Use your dashboard to manage it, or remove that listing first.",
      },
      { status: 400 }
    );
  }

  let book: Book;
  let found = await prisma.book.findFirst({
    where: { title: wish.title, author: wish.author ?? null },
  });
  if (!found) {
    found = await prisma.book.create({
      data: {
        title: wish.title,
        author: wish.author ?? null,
        isbn: null,
        coverUrl: null,
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

  const userBook = await prisma.userBook.create({
    data: {
      userId: session.user.id,
      bookId: book.id,
      bookCopyId: copy.id,
      locationType: "my_library",
      libraryPlacedAt: new Date(),
    },
    include: { book: true },
  });

  await prisma.bookWishRequest.update({
    where: { id: wishId },
    data: {
      status: "matched",
      matchedUserBookId: userBook.id,
      responderId: session.user.id,
      matchedAt: new Date(),
    },
  });

  await ensureBookCopyForUserBook(userBook.id);

  return NextResponse.json({
    ok: true,
    userBook,
    message: `Added “${book.title}” to your library and notified the requester.`,
  });
}
