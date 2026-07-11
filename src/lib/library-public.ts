import { prisma } from "@/lib/prisma";

const SLUG_MAX = 48;

/** Lowercase slug safe for URLs. */
export function slugifyLabel(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
  return base || "";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/** Pick a unique public slug for a library location. */
export async function allocatePublicSlug(hint?: string | null): Promise<string> {
  const fromHint = hint ? slugifyLabel(hint) : "";
  const candidates = [
    fromHint,
    fromHint ? `${fromHint}-${randomSuffix()}` : "",
    `library-${randomSuffix()}`,
    `library-${randomSuffix()}${randomSuffix()}`,
  ].filter(Boolean);

  for (const slug of candidates) {
    const taken = await prisma.location.findUnique({ where: { publicSlug: slug }, select: { id: true } });
    if (!taken) return slug;
  }

  return `library-${Date.now().toString(36)}`;
}

export async function ensureLocationPublicSlug(userId: string): Promise<string> {
  const loc = await prisma.location.findUnique({ where: { userId } });
  if (!loc) throw new Error("Location required");
  if (loc.publicSlug) return loc.publicSlug;

  const slug = await allocatePublicSlug(loc.label ?? loc.address);
  await prisma.location.update({
    where: { userId },
    data: { publicSlug: slug },
  });
  return slug;
}

export type PublicLibraryBook = {
  id: string;
  status: string;
  locationType: string;
  book: { title: string; author: string | null; coverUrl: string | null };
};

export type PublicLibraryPayload = {
  slug: string;
  label: string | null;
  address: string | null;
  stewardName: string | null;
  exchangeCount: number;
  libraryLastVerifiedAt: string | null;
  shareCollectionOnPublicPage: boolean;
  photoUrl: string | null;
  onShelf: PublicLibraryBook[];
  fromCollection: PublicLibraryBook[];
};

export async function getPublicLibraryBySlug(slug: string): Promise<PublicLibraryPayload | null> {
  const location = await prisma.location.findFirst({
    where: { publicSlug: slug, publicPageEnabled: true },
    include: {
      user: { select: { name: true, score: true } },
    },
  });
  if (!location) return null;

  const userBooks = await prisma.userBook.findMany({
    where: {
      userId: location.userId,
      status: { in: ["available", "claimed"] },
      locationType: location.shareCollectionOnPublicPage
        ? { in: ["my_library", "collection"] }
        : "my_library",
    },
    include: { book: { select: { title: true, author: true, coverUrl: true } } },
    orderBy: [{ locationType: "asc" }, { updatedAt: "desc" }],
  });

  const mapBook = (ub: (typeof userBooks)[number]): PublicLibraryBook => ({
    id: ub.id,
    status: ub.status,
    locationType: ub.locationType,
    book: ub.book,
  });

  const onShelf = userBooks.filter((ub) => ub.locationType === "my_library").map(mapBook);
  const fromCollection = location.shareCollectionOnPublicPage
    ? userBooks.filter((ub) => ub.locationType === "collection").map(mapBook)
    : [];

  return {
    slug: location.publicSlug!,
    label: location.label,
    address: location.address,
    stewardName: location.user.name,
    exchangeCount: location.user.score,
    libraryLastVerifiedAt: location.libraryLastVerifiedAt?.toISOString() ?? null,
    shareCollectionOnPublicPage: location.shareCollectionOnPublicPage,
    photoUrl: location.photoUrl,
    onShelf,
    fromCollection,
  };
}
