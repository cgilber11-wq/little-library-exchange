import { prisma } from "./prisma";

/** Marks overdue claims as expired and puts the book back to available. Safe to call often. */
export async function expireStaleClaims() {
  const now = new Date();
  const stale = await prisma.claim.findMany({
    where: {
      status: { in: ["pending", "book_placed"] },
      expiresAt: { lt: now },
    },
  });
  for (const c of stale) {
    await prisma.$transaction([
      prisma.claim.update({ where: { id: c.id }, data: { status: "expired" } }),
      prisma.userBook.update({
        where: { id: c.userBookId },
        data: { status: "available" },
      }),
    ]);
  }
}
