import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function createUser(
  email: string,
  password = "password123",
  name?: string,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, passwordHash, name: name ?? null },
  });
}

export async function createLocation(
  userId: string,
  opts: { lat?: number; lng?: number; label?: string; address?: string } = {},
) {
  return prisma.location.create({
    data: {
      userId,
      lat: opts.lat ?? 42.3601,
      lng: opts.lng ?? -71.0589,
      label: opts.label ?? "Test Library",
      address: opts.address ?? "123 Test St",
    },
  });
}

export async function createListedBook(
  userId: string,
  opts: {
    title?: string;
    author?: string;
    locationType?: "my_library" | "collection";
    status?: string;
  } = {},
) {
  const title = opts.title ?? "The Test Book";
  const author = opts.author ?? "Test Author";
  const locationType = opts.locationType ?? "my_library";

  const book = await prisma.book.create({
    data: { title, author },
  });
  const copy = await prisma.bookCopy.create({
    data: { bookId: book.id, originalOwnerId: userId },
  });
  const userBook = await prisma.userBook.create({
    data: {
      userId,
      bookId: book.id,
      bookCopyId: copy.id,
      locationType,
      libraryPlacedAt: locationType === "my_library" ? new Date() : null,
      status: opts.status ?? "available",
    },
    include: { book: true, bookCopy: true },
  });
  return { book, copy, userBook };
}
