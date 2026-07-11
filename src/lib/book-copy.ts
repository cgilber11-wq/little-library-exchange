import { prisma } from "./prisma";

/** Ensures a UserBook is linked to a BookCopy (for lineage). Creates one with originalOwner = current lister if missing. */
export async function ensureBookCopyForUserBook(userBookId: string) {
  const ub = await prisma.userBook.findUnique({ where: { id: userBookId } });
  if (!ub) return null;
  if (ub.bookCopyId) return ub.bookCopyId;
  const copy = await prisma.bookCopy.create({
    data: {
      bookId: ub.bookId,
      originalOwnerId: ub.userId,
    },
  });
  await prisma.userBook.update({
    where: { id: userBookId },
    data: { bookCopyId: copy.id },
  });
  return copy.id;
}
