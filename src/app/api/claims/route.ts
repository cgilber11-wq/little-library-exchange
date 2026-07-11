import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleClaims } from "@/lib/expire-claims";
import { ensureBookCopyForUserBook } from "@/lib/book-copy";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await expireStaleClaims();

  const [received, made] = await Promise.all([
    prisma.claim.findMany({
      where: { ownerId: session.user.id },
      include: {
        userBook: { include: { book: true } },
        claimer: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.claim.findMany({
      where: { claimerId: session.user.id },
      include: {
        userBook: { include: { book: true } },
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ received, made });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { userBookId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { userBookId } = body;
  if (!userBookId) return NextResponse.json({ error: "userBookId required" }, { status: 400 });

  const userBook = await prisma.userBook.findUnique({
    where: { id: userBookId },
    include: { user: true, book: true },
  });
  if (!userBook) return NextResponse.json({ error: "Book listing not found" }, { status: 404 });
  if (userBook.userId === session.user.id) return NextResponse.json({ error: "Cannot claim your own book" }, { status: 400 });
  if (userBook.status !== "available") return NextResponse.json({ error: "Book is not available" }, { status: 400 });

  const existing = await prisma.claim.findUnique({ where: { userBookId } });
  if (existing) {
    // If the previous claim expired, allow the same physical listing to be claimed again
    // by updating the existing claim row.
    if (existing.status !== "expired") {
      return NextResponse.json({ error: "Book is already claimed" }, { status: 400 });
    }
  }

  await expireStaleClaims();

  await ensureBookCopyForUserBook(userBookId);

  const owner = await prisma.user.findUnique({
    where: { id: userBook.userId },
    select: { bookCheckoutDays: true },
  });
  const windowDays = owner?.bookCheckoutDays ?? 14;
  const expiresAt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000);

  if (existing && existing.status === "expired") {
    const updated = await prisma.$transaction([
      prisma.claim.update({
        where: { id: existing.id },
        data: {
          claimerId: session.user.id,
          ownerId: userBook.userId,
          status: "pending",
          expiresAt,
          returnBy: null,
        },
      }),
      prisma.userBook.update({
        where: { id: userBookId },
        data: { status: "claimed" },
      }),
    ]);
    return NextResponse.json(updated[0]);
  }

  const [claim] = await prisma.$transaction([
    prisma.claim.create({
      data: {
        userBookId,
        claimerId: session.user.id,
        ownerId: userBook.userId,
        status: "pending",
        expiresAt,
      },
    }),
    prisma.userBook.update({
      where: { id: userBookId },
      data: { status: "claimed" },
    }),
  ]);

  return NextResponse.json(claim);
}
