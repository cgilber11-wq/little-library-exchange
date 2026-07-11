import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleClaims } from "@/lib/expire-claims";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { action?: string };
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;

  await expireStaleClaims();

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: { userBook: true },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  if (claim.status === "expired") {
    return NextResponse.json({ error: "This claim has expired" }, { status: 400 });
  }

  const now = new Date();
  if (claim.expiresAt && claim.expiresAt < now && claim.status !== "completed") {
    return NextResponse.json({ error: "This claim has expired" }, { status: 400 });
  }

  const isOwner = claim.ownerId === session.user.id;
  const isClaimer = claim.claimerId === session.user.id;

  if (action === "book_placed") {
    if (!isOwner) return NextResponse.json({ error: "Only the owner can mark book placed" }, { status: 403 });
    if (claim.status !== "pending") return NextResponse.json({ error: "Invalid status for this action" }, { status: 400 });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.claim.update({ where: { id }, data: { status: "book_placed" } });
      if (claim.userBook.locationType === "collection") {
        await tx.userBook.update({
          where: { id: claim.userBookId },
          data: { locationType: "my_library", libraryPlacedAt: now },
        });
      }
    });
    return NextResponse.json({ ok: true, status: "book_placed" });
  }

  if (action === "picked_up") {
    if (!isClaimer) return NextResponse.json({ error: "Only the claimer can mark picked up" }, { status: 403 });
    if (claim.status !== "book_placed") return NextResponse.json({ error: "Owner must mark book placed first" }, { status: 400 });
    const owner = await prisma.user.findUnique({
      where: { id: claim.ownerId },
      select: { bookReturnDays: true },
    });
    const returnDays = owner?.bookReturnDays ?? 30;
    const returnBy = new Date(Date.now() + returnDays * 24 * 60 * 60 * 1000);

    const ub = await prisma.userBook.findUnique({ where: { id: claim.userBookId } });
    const bookCopyId = ub?.bookCopyId;
    if (!bookCopyId) {
      return NextResponse.json({ error: "Book copy not linked; cannot record handoff" }, { status: 500 });
    }

    await prisma.$transaction([
      prisma.bookShareEvent.create({
        data: {
          bookCopyId,
          fromUserId: claim.ownerId,
          toUserId: claim.claimerId,
          claimId: claim.id,
        },
      }),
      prisma.claim.update({
        where: { id },
        data: { status: "completed", returnBy },
      }),
      prisma.userBook.update({ where: { id: claim.userBookId }, data: { status: "gone" } }),
      prisma.user.update({ where: { id: claim.ownerId }, data: { score: { increment: 1 } } }),
      prisma.user.update({ where: { id: claim.claimerId }, data: { score: { increment: 1 } } }),
    ]);
    return NextResponse.json({ ok: true, status: "completed", returnBy });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
