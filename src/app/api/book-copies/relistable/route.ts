import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Copies you currently hold (last handoff) with no active listing — safe to relist. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;

  const received = await prisma.bookShareEvent.findMany({
    where: { toUserId: uid },
    select: { bookCopyId: true },
  });
  const copyIds = [...new Set(received.map((r) => r.bookCopyId))];

  const out: {
    bookCopyId: string;
    book: { title: string; author: string | null; coverUrl: string | null };
    handoffCount: number;
  }[] = [];

  for (const copyId of copyIds) {
    const last = await prisma.bookShareEvent.findFirst({
      where: { bookCopyId: copyId },
      orderBy: { createdAt: "desc" },
      include: {
        bookCopy: {
          include: {
            book: true,
            _count: { select: { shareEvents: true } },
          },
        },
      },
    });
    if (!last || last.toUserId !== uid) continue;

    const activeListing = await prisma.userBook.findFirst({
      where: {
        bookCopyId: copyId,
        status: { in: ["available", "claimed"] },
      },
    });
    if (activeListing) continue;

    out.push({
      bookCopyId: copyId,
      book: {
        title: last.bookCopy.book.title,
        author: last.bookCopy.book.author,
        coverUrl: last.bookCopy.book.coverUrl,
      },
      handoffCount: last.bookCopy._count.shareEvents,
    });
  }

  return NextResponse.json({ copies: out });
}
