const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { libraryProfileSeedFields } = require("./lib/seed-library-profiles");

const prisma = new PrismaClient();

const SEED_DOMAIN = "@seed.lle";
const PASSWORD = "password123";

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function hours(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function createSeedUser({
  email,
  name,
  score,
  lat,
  lng,
  label,
  address,
  checkoutDays = 14,
  returnDays = 30,
  profileKey,
  publicSlug,
  shareCollectionOnPublicPage = true,
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const profile = libraryProfileSeedFields({
    key: profileKey,
    label,
    publicSlug,
    shareCollectionOnPublicPage,
  });
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      score,
      bookCheckoutDays: checkoutDays,
      bookReturnDays: returnDays,
      createdAt: daysAgo(18),
      location: {
        create: {
          label,
          address,
          lat,
          lng,
          libraryLastVerifiedAt: daysAgo(0.25),
          ...profile,
        },
      },
    },
    include: { location: true },
  });
  return user;
}

async function createListing(user, { title, author, locationType = "my_library", status = "available", createdAt = daysAgo(2) }) {
  const book = await prisma.book.create({
    data: { title, author: author ?? null, createdAt },
  });
  const copy = await prisma.bookCopy.create({
    data: {
      bookId: book.id,
      originalOwnerId: user.id,
      createdAt,
    },
  });
  const userBook = await prisma.userBook.create({
    data: {
      userId: user.id,
      bookId: book.id,
      bookCopyId: copy.id,
      status,
      locationType,
      libraryPlacedAt: locationType === "my_library" ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
    },
    include: { book: true, bookCopy: true },
  });
  return { book, copy, userBook };
}

async function createClaim({ listing, owner, claimer, status, createdAt, expiresAt, returnBy }) {
  const claim = await prisma.claim.create({
    data: {
      userBookId: listing.id,
      ownerId: owner.id,
      claimerId: claimer.id,
      status,
      expiresAt: expiresAt ?? daysFromNow(7),
      returnBy: returnBy ?? null,
      createdAt,
      updatedAt: createdAt,
    },
  });

  await prisma.userBook.update({
    where: { id: listing.id },
    data: {
      status: status === "completed" ? "gone" : status === "expired" ? "available" : "claimed",
      updatedAt: createdAt,
    },
  });

  if (status === "completed") {
    await prisma.bookShareEvent.create({
      data: {
        bookCopyId: listing.bookCopyId,
        fromUserId: owner.id,
        toUserId: claimer.id,
        claimId: claim.id,
        createdAt,
      },
    });
  }

  return claim;
}

async function main() {
  const seedUsers = await prisma.user.findMany({
    where: { email: { endsWith: SEED_DOMAIN } },
    select: { id: true },
  });

  if (seedUsers.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: seedUsers.map((u) => u.id) } },
    });
    await prisma.book.deleteMany({
      where: {
        userBooks: { none: {} },
        bookCopies: { none: {} },
      },
    });
  }

  const riley = await createSeedUser({
    email: "riley@seed.lle",
    name: "Riley Reader",
    score: 6,
    lat: 42.3601,
    lng: -71.0589,
    label: "Riley's Little Library",
    address: "Boston Common, Boston, MA",
    checkoutDays: 10,
    returnDays: 21,
    profileKey: "riley",
    publicSlug: "rileys-little-library",
  });
  const jordan = await createSeedUser({
    email: "jordan@seed.lle",
    name: "Jordan Neighbor",
    score: 3,
    lat: 42.3656,
    lng: -71.064,
    label: "Jordan's Front-Yard Shelf",
    address: "Beacon Hill, Boston, MA",
    profileKey: "jordan",
    publicSlug: "jordans-front-yard-shelf",
  });
  const casey = await createSeedUser({
    email: "casey@seed.lle",
    name: "Casey Bookworm",
    score: 11,
    lat: 42.3736,
    lng: -71.1097,
    label: "Casey's Porch Library",
    address: "Cambridge, MA",
    profileKey: "casey",
    publicSlug: "caseys-porch-library",
  });
  const morgan = await createSeedUser({
    email: "morgan@seed.lle",
    name: "Morgan Pages",
    score: 18,
    lat: 42.3355,
    lng: -71.1054,
    label: "Morgan's Tiny Library",
    address: "Brookline, MA",
    profileKey: "morgan",
    publicSlug: "morgans-tiny-library",
    shareCollectionOnPublicPage: false,
  });
  const sam = await createSeedUser({
    email: "sam@seed.lle",
    name: "Sam Storyteller",
    score: 1,
    lat: 42.3876,
    lng: -71.0995,
    label: "Sam's Sidewalk Shelf",
    address: "Somerville, MA",
    profileKey: "sam",
    publicSlug: "sams-sidewalk-shelf",
  });

  await createListing(riley, { title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", createdAt: daysAgo(1) });
  await createListing(riley, { title: "The Anthropocene Reviewed", author: "John Green", createdAt: daysAgo(0.75) });
  await createListing(riley, {
    title: "A Psalm for the Wild-Built",
    author: "Becky Chambers",
    locationType: "collection",
    createdAt: daysAgo(3),
  });
  await createListing(riley, {
    title: "The Vanishing Half",
    author: "Brit Bennett",
    locationType: "collection",
    createdAt: daysAgo(4),
  });

  const midnight = await createListing(riley, {
    title: "The Midnight Library",
    author: "Matt Haig",
    status: "claimed",
    createdAt: daysAgo(2),
  });
  await createClaim({
    listing: midnight.userBook,
    owner: riley,
    claimer: jordan,
    status: "pending",
    createdAt: daysAgo(0.15),
    expiresAt: daysFromNow(9),
  });

  const hailMary = await createListing(riley, {
    title: "Project Hail Mary",
    author: "Andy Weir",
    status: "claimed",
    createdAt: daysAgo(5),
  });
  await createClaim({
    listing: hailMary.userBook,
    owner: riley,
    claimer: casey,
    status: "book_placed",
    createdAt: daysAgo(0.5),
    expiresAt: daysFromNow(2),
  });

  const sea = await createListing(morgan, {
    title: "The Sea of Tranquility",
    author: "Emily St. John Mandel",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(4),
  });
  await createClaim({
    listing: sea.userBook,
    owner: morgan,
    claimer: riley,
    status: "pending",
    createdAt: daysAgo(0.35),
    expiresAt: daysFromNow(8),
  });

  const tomorrow = await createListing(sam, {
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(6),
  });
  await createClaim({
    listing: tomorrow.userBook,
    owner: sam,
    claimer: riley,
    status: "book_placed",
    createdAt: daysAgo(0.08),
    expiresAt: daysFromNow(1),
  });

  const kindred = await createListing(jordan, {
    title: "Kindred",
    author: "Octavia E. Butler",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(3),
  });
  await createClaim({
    listing: kindred.userBook,
    owner: jordan,
    claimer: riley,
    status: "book_placed",
    createdAt: hours(12),
    expiresAt: daysFromNow(6),
  });

  const station = await createListing(riley, {
    title: "Station Eleven",
    author: "Emily St. John Mandel",
    status: "gone",
    createdAt: daysAgo(14),
  });
  await createClaim({
    listing: station.userBook,
    owner: riley,
    claimer: morgan,
    status: "completed",
    createdAt: daysAgo(2),
    expiresAt: daysAgo(1),
    returnBy: daysFromNow(19),
  });

  const piranesi = await createListing(riley, {
    title: "Piranesi",
    author: "Susanna Clarke",
    status: "gone",
    createdAt: daysAgo(12),
  });
  await createClaim({
    listing: piranesi.userBook,
    owner: riley,
    claimer: sam,
    status: "completed",
    createdAt: daysAgo(5),
    expiresAt: daysAgo(4),
    returnBy: daysFromNow(16),
  });

  const olderTraveler = await createListing(riley, {
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    status: "gone",
    createdAt: daysAgo(21),
  });
  await createClaim({
    listing: olderTraveler.userBook,
    owner: riley,
    claimer: jordan,
    status: "completed",
    createdAt: daysAgo(10),
    expiresAt: daysAgo(9),
    returnBy: daysFromNow(11),
  });
  await prisma.bookShareEvent.create({
    data: {
      bookCopyId: olderTraveler.copy.id,
      fromUserId: jordan.id,
      toUserId: casey.id,
      createdAt: daysAgo(3),
    },
  });

  await createListing(jordan, { title: "Circe", author: "Madeline Miller", createdAt: daysAgo(1.5) });
  await createListing(casey, { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", createdAt: daysAgo(2.5) });
  await createListing(morgan, { title: "Homegoing", author: "Yaa Gyasi", createdAt: daysAgo(0.4) });
  await createListing(sam, { title: "Legends & Lattes", author: "Travis Baldree", createdAt: daysAgo(0.9) });

  const matchedBook = await createListing(casey, {
    title: "Remarkably Bright Creatures",
    author: "Shelby Van Pelt",
    createdAt: daysAgo(0.2),
  });

  await prisma.bookWishRequest.createMany({
    data: [
      {
        userId: riley.id,
        title: "Demon Copperhead",
        author: "Barbara Kingsolver",
        note: "Paperback preferred, but any copy is great.",
        status: "open",
        createdAt: daysAgo(0.2),
        updatedAt: daysAgo(0.2),
      },
      {
        userId: riley.id,
        title: "Remarkably Bright Creatures",
        author: "Shelby Van Pelt",
        note: "Looking for this for book club next week.",
        status: "matched",
        matchedUserBookId: matchedBook.userBook.id,
        responderId: casey.id,
        matchedAt: daysAgo(0.1),
        createdAt: daysAgo(1),
        updatedAt: daysAgo(0.1),
      },
      {
        userId: jordan.id,
        title: "The Creative Act",
        author: "Rick Rubin",
        note: "Curious to borrow this one.",
        status: "open",
        createdAt: daysAgo(0.6),
        updatedAt: daysAgo(0.6),
      },
      {
        userId: casey.id,
        title: "The Heaven & Earth Grocery Store",
        author: "James McBride",
        note: "Happy to pick up nearby.",
        status: "open",
        createdAt: daysAgo(0.9),
        updatedAt: daysAgo(0.9),
      },
    ],
  });

  console.log("Seeded recent development data.");
  console.log(`Primary login: riley@seed.lle / ${PASSWORD}`);
  console.log("Other logins: jordan@seed.lle, casey@seed.lle, morgan@seed.lle, sam@seed.lle");
  console.log("Library profiles:");
  for (const user of [riley, jordan, casey, morgan, sam]) {
    const slug = user.location?.publicSlug;
    if (slug) console.log(`  /library/${slug} — ${user.location?.label}`);
  }
  console.log("Riley's pickups (dashboard) → owner profiles:");
  for (const owner of [morgan, sam, jordan]) {
    const slug = owner.location?.publicSlug;
    if (slug) console.log(`  ${owner.location?.label} → /library/${slug}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
