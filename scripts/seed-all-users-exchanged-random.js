const { PrismaClient } = require("@prisma/client");
const { libraryProfileSeedFields, slugifyLabel, pickSeedPhotoKey } = require("./lib/seed-library-profiles");

const prisma = new PrismaClient();

const ORIGIN = { lat: 40.0791, lng: -75.3652, label: "King of Prussia, PA" };
const MAX_DISTANCE_MILES = 50;

const MAX_BOOKS_PER_USER = 100;
const MIN_BOOKS_PER_USER = 5;
const MAX_HANDOFFS_PER_COPY = 10;
const MIN_HANDOFFS_PER_COPY = 1; // >=1 so every seeded copy has been exchanged

// Small catalog to reuse Book rows (prevents thousands of duplicate Book records).
const CATALOG = [
  { title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling" },
  { title: "The Hobbit", author: "J.R.R. Tolkien" },
  { title: "To Kill a Mockingbird", author: "Harper Lee" },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  { title: "Pride and Prejudice", author: "Jane Austen" },
  { title: "The Catcher in the Rye", author: "J.D. Salinger" },
  { title: "The Chronicles of Narnia", author: "C.S. Lewis" },
  { title: "Little Women", author: "Louisa May Alcott" },
  { title: "The Lord of the Rings", author: "J.R.R. Tolkien" },
  { title: "Jane Eyre", author: "Charlotte Brontë" },
  { title: "The Diary of a Young Girl", author: "Anne Frank" },
  { title: "Brave New World", author: "Aldous Huxley" },
  { title: "Of Mice and Men", author: "John Steinbeck" },
  { title: "The Grapes of Wrath", author: "John Steinbeck" },
  { title: "Fahrenheit 451", author: "Ray Bradbury" },
  { title: "The Road", author: "Cormac McCarthy" },
  { title: "The Handmaid's Tale", author: "Margaret Atwood" },
  { title: "The Martian", author: "Andy Weir" },
  { title: "Dune", author: "Frank Herbert" },
  { title: "1984", author: "George Orwell" },
  { title: "The Outsiders", author: "S.E. Hinton" },
  { title: "Animal Farm", author: "George Orwell" },
];

function randInt(minInclusive, maxInclusive) {
  return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

// Uniform distribution across area: r = R * sqrt(u)
function randomPointWithinRadiusMiles({ lat, lng }, radiusMiles) {
  const u = Math.random();
  const r = radiusMiles * Math.sqrt(u);
  const theta = Math.random() * 2 * Math.PI;

  const dxMiles = r * Math.cos(theta); // east-west
  const dyMiles = r * Math.sin(theta); // north-south

  const latDeg = dyMiles / 69.0;
  const lngDeg = dxMiles / (69.0 * Math.cos((lat * Math.PI) / 180));

  return { lat: lat + latDeg, lng: lng + lngDeg };
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, bookCheckoutDays: true, bookReturnDays: true, score: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    console.log("No users found. Nothing to seed.");
    await prisma.$disconnect();
    return;
  }

  // Capture existing Book ids for cleanup, before deleting userBooks.
  const existingUserBooks = await prisma.userBook.findMany({
    where: { userId: { in: userIds } },
    select: { bookId: true },
  });
  const existingBookIds = [...new Set(existingUserBooks.map((x) => x.bookId))];

  // Reset user scores (we'll recompute based on seeded handoffs).
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { score: 0 },
  });

  // Clear previous test exchange artifacts for these users.
  await prisma.bookShareEvent.deleteMany({
    where: {
      OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }],
    },
  });
  await prisma.claim.deleteMany({
    where: {
      OR: [{ ownerId: { in: userIds } }, { claimerId: { in: userIds } }],
    },
  });
  await prisma.userBook.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.bookCopy.deleteMany({
    where: { originalOwnerId: { in: userIds } },
  });
  await prisma.location.deleteMany({
    where: { userId: { in: userIds } },
  });

  if (existingBookIds.length > 0) {
    await prisma.book.deleteMany({
      where: { id: { in: existingBookIds } },
    });
  }

  // Create a reusable catalog of Book rows.
  const createdBooks = [];
  for (const entry of CATALOG) {
    const b = await prisma.book.create({
      data: {
        title: entry.title,
        author: entry.author,
        coverUrl: null,
        isbn: null,
      },
    });
    createdBooks.push(b);
  }

  // Assign each user a location within 50 miles of King of Prussia.
  for (const u of users) {
    const p = randomPointWithinRadiusMiles(ORIGIN, MAX_DISTANCE_MILES);
    const label = `${u.name ?? "Library"} — near ${ORIGIN.label}`;
    const address = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
    const profile = libraryProfileSeedFields({
      key: pickSeedPhotoKey(u.id),
      label,
      publicSlug: `${slugifyLabel(u.name ?? "library")}-${u.id.slice(-6)}`,
    });
    await prisma.location.create({
      data: {
        userId: u.id,
        label,
        address,
        lat: p.lat,
        lng: p.lng,
        ...profile,
      },
    });
  }

  const scores = new Map(userIds.map((id) => [id, 0]));

  // Main generation:
  // For each user, create N current available listings (they currently hold the physical copy).
  // Each physical copy has handoffCount completed handoffs behind it (>=1), so the copy is "exchanged".
  for (const holder of users) {
    const currentUserId = holder.id;
    const count = randInt(MIN_BOOKS_PER_USER, MAX_BOOKS_PER_USER);

    for (let i = 0; i < count; i++) {
      const book = createdBooks[randInt(0, createdBooks.length - 1)];
      const handoffs = randInt(MIN_HANDOFFS_PER_COPY, MAX_HANDOFFS_PER_COPY);
      const originalOwnerId = userIds[randInt(0, userIds.length - 1)];

      const copy = await prisma.bookCopy.create({
        data: {
          bookId: book.id,
          originalOwnerId,
        },
      });

      let fromUserId = originalOwnerId;
      for (let step = 1; step <= handoffs; step++) {
        const toUserId =
          step === handoffs
            ? currentUserId
            : userIds[randInt(0, userIds.length - 1)];

        // Keep the chain moving; avoid trivial self-handoff most of the time.
        const safeToUserId = toUserId === fromUserId ? userIds[(userIds.indexOf(toUserId) + 1) % userIds.length] : toUserId;

        await prisma.bookShareEvent.create({
          data: {
            bookCopyId: copy.id,
            fromUserId,
            toUserId: safeToUserId,
            claimId: null,
          },
        });

        scores.set(fromUserId, (scores.get(fromUserId) || 0) + 1);
        scores.set(safeToUserId, (scores.get(safeToUserId) || 0) + 1);

        fromUserId = safeToUserId;
      }

      const inCollection = Math.random() < 0.35;
      const locationType = inCollection ? "collection" : "my_library";

      await prisma.userBook.create({
        data: {
          userId: currentUserId,
          bookId: book.id,
          bookCopyId: copy.id,
          status: "available",
          locationType,
        },
      });
    }
  }

  // Apply computed score updates.
  for (const [userId, score] of scores.entries()) {
    await prisma.user.update({
      where: { id: userId },
      data: { score },
    });
  }

  console.log("Seeded exchanged test data for all users.");
  console.log(`Users: ${users.length}`);
  console.log("Per-user book count: random 5..100 (seed).");
  console.log("Per-copy handoffs: random 1..10 (seed).");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});

