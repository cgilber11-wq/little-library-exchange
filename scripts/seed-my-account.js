/**
 * Rebuilds a full-coverage test dataset around ONE real account.
 *
 * Usage:
 *   SEED_EMAIL=you@example.com npm run db:seed:me
 *   (defaults to collin.gilbertemail@gmail.com)
 *
 * It wipes ONLY:
 *   - the target account's books, copies, claims, wishes, and share events
 *   - helper neighbor accounts like jordan.{userIdSuffix}@nbr.lle
 * Your other real accounts are left untouched.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const {
  libraryProfileSeedFields,
  neighborProfileSlug,
  SEED_LIBRARY_PHOTOS,
} = require("./lib/seed-library-profiles");

const prisma = new PrismaClient();

const TARGET_EMAIL = process.env.SEED_EMAIL || "collin.gilbertemail@gmail.com";
const NEIGHBOR_DOMAIN = "@nbr.lle";
const PASSWORD = "password123";

const hours = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

const DEFAULT_ORIGIN = {
  lat: 42.3601,
  lng: -71.0589,
  label: "My Little Library",
  address: "Boston Common, Boston, MA",
};

/** Small lat/lng offsets (~0.5–3 mi) so neighbors cluster around the target account. */
const NEIGHBOR_OFFSETS = {
  jordan: { dLat: 0.0055, dLng: -0.0051, label: "Jordan's Front-Yard Shelf" },
  casey: { dLat: 0.0135, dLng: -0.0508, label: "Casey's Porch Library" },
  morgan: { dLat: -0.0246, dLng: -0.0465, label: "Morgan's Tiny Library" },
  sam: { dLat: 0.0275, dLng: -0.0406, label: "Sam's Sidewalk Shelf" },
};

function offsetCoords(baseLat, baseLng, dLat, dLng) {
  return { lat: baseLat + dLat, lng: baseLng + dLng };
}

async function makeNeighbor({ email, name, score, lat, lng, label, address, neighborKey, accountIdSuffix }) {
  const profile = libraryProfileSeedFields({
    key: neighborKey,
    label,
    publicSlug: neighborProfileSlug(neighborKey, accountIdSuffix),
    shareCollectionOnPublicPage: neighborKey !== "morgan",
  });
  return prisma.user.create({
    data: {
      email,
      name,
      score,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      createdAt: daysAgo(20),
      location: {
        create: {
          label,
          address,
          lat,
          lng,
          libraryLastVerifiedAt: daysAgo(0.5),
          ...profile,
        },
      },
    },
    include: { location: true },
  });
}

/** Create a book + tracked copy + listing owned by `owner`. */
async function listing(owner, opts) {
  const {
    title,
    author = null,
    locationType = "my_library",
    status = "available",
    createdAt = daysAgo(2),
    originalOwnerId = owner.id,
  } = opts;

  const book = await prisma.book.create({ data: { title, author, createdAt } });
  const copy = await prisma.bookCopy.create({
    data: { bookId: book.id, originalOwnerId, createdAt },
  });
  const userBook = await prisma.userBook.create({
    data: {
      userId: owner.id,
      bookId: book.id,
      bookCopyId: copy.id,
      status,
      locationType,
      libraryPlacedAt: locationType === "my_library" ? createdAt : null,
      removedAt: status === "removed" ? daysAgo(1) : null,
      createdAt,
      updatedAt: createdAt,
    },
    include: { book: true },
  });
  return { book, copy, userBook };
}

async function claim({ listing, owner, claimer, status, createdAt, expiresAt, returnBy }) {
  const c = await prisma.claim.create({
    data: {
      userBookId: listing.userBook.id,
      ownerId: owner.id,
      claimerId: claimer.id,
      status,
      expiresAt,
      returnBy: returnBy ?? null,
      createdAt,
      updatedAt: createdAt,
    },
  });
  if (status === "completed") {
    await prisma.bookShareEvent.create({
      data: {
        bookCopyId: listing.copy.id,
        fromUserId: owner.id,
        toUserId: claimer.id,
        claimId: c.id,
        createdAt,
      },
    });
  }
  return c;
}

async function wipeAccount(meId, neighborTag) {
  const neighbors = await prisma.user.findMany({
    where: { email: { endsWith: `${neighborTag}${NEIGHBOR_DOMAIN}` } },
    select: { id: true },
  });
  if (neighbors.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: neighbors.map((n) => n.id) } } });
  }

  await prisma.bookShareEvent.deleteMany({
    where: { OR: [{ fromUserId: meId }, { toUserId: meId }] },
  });
  await prisma.claim.deleteMany({ where: { OR: [{ ownerId: meId }, { claimerId: meId }] } });
  await prisma.bookWishRequest.deleteMany({ where: { userId: meId } });
  await prisma.userBook.deleteMany({ where: { userId: meId } });
  await prisma.bookCopy.deleteMany({ where: { originalOwnerId: meId } });

  await prisma.book.deleteMany({
    where: { userBooks: { none: {} }, bookCopies: { none: {} } },
  });
}

async function main() {
  let me = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!me) {
    me = await prisma.user.create({
      data: {
        email: TARGET_EMAIL,
        name: "Collin",
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        score: 12,
      },
    });
    console.log(`Created account ${TARGET_EMAIL} (password "${PASSWORD}")`);
  }

  await wipeAccount(me.id, `.${me.id.slice(-8)}`);

  // Mid-tier goodwill: earns First + Bronze + Silver, with Gold (20) as the next badge.
  await prisma.user.update({ where: { id: me.id }, data: { score: 12 } });

  const existingLocation = await prisma.location.findUnique({ where: { userId: me.id } });
  const hasCoords = existingLocation?.lat != null && existingLocation?.lng != null;
  const baseLat = hasCoords ? existingLocation.lat : DEFAULT_ORIGIN.lat;
  const baseLng = hasCoords ? existingLocation.lng : DEFAULT_ORIGIN.lng;

  if (!existingLocation) {
    await prisma.location.create({
      data: {
        userId: me.id,
        label: DEFAULT_ORIGIN.label,
        address: DEFAULT_ORIGIN.address,
        lat: baseLat,
        lng: baseLng,
        libraryLastVerifiedAt: hours(6),
        publicSlug: "my-little-library",
        shareCollectionOnPublicPage: true,
        publicPageEnabled: true,
        photoUrl: SEED_LIBRARY_PHOTOS.default,
      },
    });
  } else {
    await prisma.location.update({
      where: { userId: me.id },
      data: {
        ...(hasCoords
          ? {}
          : {
              lat: DEFAULT_ORIGIN.lat,
              lng: DEFAULT_ORIGIN.lng,
              label: existingLocation.label ?? DEFAULT_ORIGIN.label,
              address: existingLocation.address ?? DEFAULT_ORIGIN.address,
            }),
        libraryLastVerifiedAt: hours(6),
        publicSlug: existingLocation.publicSlug ?? "my-little-library",
        shareCollectionOnPublicPage: true,
        publicPageEnabled: true,
        photoUrl: SEED_LIBRARY_PHOTOS.default,
      },
    });
  }

  const neighborTag = `.${me.id.slice(-8)}`;

  console.log(
    `Placing neighbors near ${baseLat.toFixed(4)}, ${baseLng.toFixed(4)}` +
      (hasCoords ? " (your saved library)" : " (default Boston origin — set Location for your area)"),
  );

  const neighbors = {};
  for (const [key, spec] of Object.entries(NEIGHBOR_OFFSETS)) {
    const coords = offsetCoords(baseLat, baseLng, spec.dLat, spec.dLng);
    const names = {
      jordan: ["Jordan Neighbor", 4],
      casey: ["Casey Bookworm", 9],
      morgan: ["Morgan Pages", 22],
      sam: ["Sam Storyteller", 1],
    };
    const [name, score] = names[key];
    neighbors[key] = await makeNeighbor({
      email: `${key}${neighborTag}${NEIGHBOR_DOMAIN}`,
      name,
      score,
      lat: coords.lat,
      lng: coords.lng,
      label: spec.label,
      address: `Near your library (seed) · ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
      neighborKey: key,
      accountIdSuffix: neighborTag,
    });
  }

  // ---- My inventory: every locationType + lifecycle state ----
  await listing(me, { title: "Braiding Sweetgrass", author: "Robin Wall Kimmerer", createdAt: hours(20) });
  await listing(me, { title: "The Overstory", author: "Richard Powers", createdAt: daysAgo(1.4) });
  await listing(me, { title: "A Psalm for the Wild-Built", author: "Becky Chambers", locationType: "collection", createdAt: daysAgo(3) });
  await listing(me, {
    title: "The Vanishing Half",
    author: "Brit Bennett",
    locationType: "collection",
    createdAt: daysAgo(4),
  });
  await listing(me, { title: "Old Yeller", author: "Fred Gipson", status: "removed", createdAt: daysAgo(9) });

  // ---- Requests on MY books (claims received): pending / book_placed / completed / expired ----
  const midnight = await listing(me, { title: "The Midnight Library", author: "Matt Haig", status: "claimed", createdAt: daysAgo(2) });
  await claim({ listing: midnight, owner: me, claimer: neighbors.jordan, status: "pending", createdAt: hours(4), expiresAt: daysFromNow(9) });

  const hailMary = await listing(me, { title: "Project Hail Mary", author: "Andy Weir", status: "claimed", createdAt: daysAgo(5) });
  await claim({ listing: hailMary, owner: me, claimer: neighbors.casey, status: "book_placed", createdAt: hours(10), expiresAt: daysFromNow(3) });

  const station = await listing(me, { title: "Station Eleven", author: "Emily St. John Mandel", status: "gone", createdAt: daysAgo(15) });
  await claim({ listing: station, owner: me, claimer: neighbors.morgan, status: "completed", createdAt: daysAgo(2), expiresAt: daysAgo(1), returnBy: daysFromNow(19) });

  const klara = await listing(me, { title: "Klara and the Sun", author: "Kazuo Ishiguro", status: "available", createdAt: daysAgo(8) });
  await claim({ listing: klara, owner: me, claimer: neighbors.sam, status: "expired", createdAt: daysAgo(7), expiresAt: daysAgo(1) });

  // ---- Books I introduced that have traveled (impact / top traveler) ----
  const hobbit = await listing(me, { title: "The Hobbit", author: "J.R.R. Tolkien", status: "gone", createdAt: daysAgo(24) });
  await claim({ listing: hobbit, owner: me, claimer: neighbors.jordan, status: "completed", createdAt: daysAgo(12), expiresAt: daysAgo(11), returnBy: daysFromNow(9) });
  await prisma.bookShareEvent.create({ data: { bookCopyId: hobbit.copy.id, fromUserId: neighbors.jordan.id, toUserId: neighbors.casey.id, createdAt: daysAgo(6) } });
  await prisma.bookShareEvent.create({ data: { bookCopyId: hobbit.copy.id, fromUserId: neighbors.casey.id, toUserId: neighbors.morgan.id, createdAt: daysAgo(2) } });

  const piranesi = await listing(me, { title: "Piranesi", author: "Susanna Clarke", status: "gone", createdAt: daysAgo(18) });
  await claim({ listing: piranesi, owner: me, claimer: neighbors.sam, status: "completed", createdAt: daysAgo(5), expiresAt: daysAgo(4), returnBy: daysFromNow(16) });
  await prisma.bookShareEvent.create({ data: { bookCopyId: piranesi.copy.id, fromUserId: neighbors.sam.id, toUserId: neighbors.casey.id, createdAt: daysAgo(1) } });

  // ---- Books I'm picking up (claims made): pending / urgent placed / placed / completed / expired ----
  const sea = await listing(neighbors.morgan, {
    title: "The Sea of Tranquility",
    author: "Emily St. John Mandel",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(4),
  });
  await claim({ listing: sea, owner: neighbors.morgan, claimer: me, status: "pending", createdAt: hours(5), expiresAt: daysFromNow(8) });

  const tomorrow = await listing(neighbors.sam, {
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(6),
  });
  await claim({ listing: tomorrow, owner: neighbors.sam, claimer: me, status: "book_placed", createdAt: hours(2), expiresAt: daysFromNow(1) }); // urgent (<48h)

  const kindred = await listing(neighbors.jordan, {
    title: "Kindred",
    author: "Octavia E. Butler",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(3),
  });
  await claim({ listing: kindred, owner: neighbors.jordan, claimer: me, status: "book_placed", createdAt: hours(12), expiresAt: daysFromNow(6) });

  const educated = await listing(neighbors.casey, {
    title: "Educated",
    author: "Tara Westover",
    status: "claimed",
    locationType: "my_library",
    createdAt: daysAgo(5),
  });
  await claim({ listing: educated, owner: neighbors.casey, claimer: me, status: "book_placed", createdAt: hours(8), expiresAt: daysFromNow(4) });

  // Completed pickup → I now hold this copy with no active listing → appears as "relistable".
  const lattes = await listing(neighbors.casey, { title: "Legends & Lattes", author: "Travis Baldree", status: "gone", createdAt: daysAgo(10) });
  await claim({ listing: lattes, owner: neighbors.casey, claimer: me, status: "completed", createdAt: daysAgo(3), expiresAt: daysAgo(2), returnBy: daysFromNow(27) });

  const homegoing = await listing(neighbors.morgan, { title: "Homegoing", author: "Yaa Gyasi", status: "available", createdAt: daysAgo(11) });
  await claim({ listing: homegoing, owner: neighbors.morgan, claimer: me, status: "expired", createdAt: daysAgo(10), expiresAt: daysAgo(2) });

  // ---- Nearby community listings (Find a Book / nearby) ----
  await listing(neighbors.casey, { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", createdAt: daysAgo(1) });
  await listing(neighbors.jordan, { title: "Circe", author: "Madeline Miller", createdAt: hours(16) });
  await listing(neighbors.sam, {
    title: "The Three-Body Problem",
    author: "Liu Cixin",
    locationType: "collection",
    createdAt: daysAgo(2),
  });
  const brightCreatures = await listing(neighbors.casey, { title: "Remarkably Bright Creatures", author: "Shelby Van Pelt", createdAt: hours(8) });

  // ---- My wishes: open (x3) / matched (triggers dashboard alert) / cancelled ----
  await prisma.bookWishRequest.create({
    data: { userId: me.id, title: "Demon Copperhead", author: "Barbara Kingsolver", note: "Any copy welcome.", status: "open", createdAt: hours(5), updatedAt: hours(5) },
  });
  await prisma.bookWishRequest.create({
    data: { userId: me.id, title: "The Creative Act", author: "Rick Rubin", note: "Would love to borrow.", status: "open", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  });
  await prisma.bookWishRequest.create({
    data: { userId: me.id, title: "Babel", author: "R.F. Kuang", status: "open", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  });
  await prisma.bookWishRequest.create({
    data: {
      userId: me.id,
      title: "Remarkably Bright Creatures",
      author: "Shelby Van Pelt",
      note: "For book club next week.",
      status: "matched",
      matchedUserBookId: brightCreatures.userBook.id,
      responderId: neighbors.casey.id,
      matchedAt: hours(3),
      createdAt: daysAgo(1.5),
      updatedAt: hours(3),
    },
  });
  await prisma.bookWishRequest.create({
    data: { userId: me.id, title: "The Goldfinch", author: "Donna Tartt", status: "cancelled", createdAt: daysAgo(6), updatedAt: daysAgo(5) },
  });

  // ---- Community wishlist from neighbors (others looking for books) ----
  await prisma.bookWishRequest.createMany({
    data: [
      { userId: neighbors.jordan.id, title: "The Heaven & Earth Grocery Store", author: "James McBride", status: "open", createdAt: hours(9), updatedAt: hours(9) },
      { userId: neighbors.morgan.id, title: "Fourth Wing", author: "Rebecca Yarros", status: "open", createdAt: daysAgo(1), updatedAt: daysAgo(1) },
      { userId: neighbors.sam.id, title: "Lessons in Chemistry", author: "Bonnie Garmus", status: "open", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    ],
  });

  const [books, copies, claims, wishes, events] = await Promise.all([
    prisma.userBook.count({ where: { userId: me.id } }),
    prisma.bookCopy.count({ where: { originalOwnerId: me.id } }),
    prisma.claim.count({ where: { OR: [{ ownerId: me.id }, { claimerId: me.id }] } }),
    prisma.bookWishRequest.count({ where: { userId: me.id } }),
    prisma.bookShareEvent.count(),
  ]);

  console.log(`Rebuilt full-coverage data for ${TARGET_EMAIL}`);
  console.log(`  listings: ${books} | introduced copies: ${copies} | claims: ${claims} | wishes: ${wishes} | share events: ${events}`);
  console.log(
    `Neighbor logins (password "${PASSWORD}"):`,
    Object.keys(NEIGHBOR_OFFSETS)
      .map((key) => `${key}${neighborTag}${NEIGHBOR_DOMAIN}`)
      .join(", "),
  );
  console.log("Neighbor library profiles:");
  for (const [key, neighbor] of Object.entries(neighbors)) {
    const slug = neighbor.location?.publicSlug;
    if (slug) console.log(`  /library/${slug} — ${neighbor.location?.label}`);
  }
  console.log(`Your library profile: /library/my-little-library`);
  console.log("My pickups (dashboard) → owner profiles:");
  for (const [owner, slug] of [
    [neighbors.morgan, neighbors.morgan.location?.publicSlug],
    [neighbors.sam, neighbors.sam.location?.publicSlug],
    [neighbors.jordan, neighbors.jordan.location?.publicSlug],
    [neighbors.casey, neighbors.casey.location?.publicSlug],
  ]) {
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
