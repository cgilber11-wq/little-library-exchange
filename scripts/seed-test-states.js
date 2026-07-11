const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const PASSWORD = "password";

// Emails must be unique in the DB. Use stable values so the script can be re-run.
const USERS = [
  {
    key: "ownerA",
    email: "test.ownerA@example.com",
    name: "Test Owner A",
    bookCheckoutDays: 7,
    bookReturnDays: 14,
    location: { label: "Owner A Library", lat: 40.0000, lng: -75.0000, address: "40.0000, -75.0000" },
  },
  {
    key: "borrowerB",
    email: "test.borrowerB@example.com",
    name: "Test Borrower B",
    bookCheckoutDays: 7,
    bookReturnDays: 14,
    location: { label: "Borrower B Library", lat: 40.0500, lng: -75.0000, address: "40.0500, -75.0000" },
  },
  {
    key: "borrowerC",
    email: "test.borrowerC@example.com",
    name: "Test Borrower C",
    bookCheckoutDays: 7,
    bookReturnDays: 14,
    location: { label: "Borrower C Library", lat: 41.0000, lng: -75.0000, address: "41.0000, -75.0000" },
  },
  {
    key: "ownerD",
    email: "test.ownerD@example.com",
    name: "Test Owner D",
    bookCheckoutDays: 7,
    bookReturnDays: 14,
    location: { label: "Owner D Library", lat: 39.9000, lng: -75.0000, address: "39.9000, -75.0000" },
  },
];

async function main() {
  const usersExisting = await prisma.user.findMany({
    where: { email: { in: USERS.map((u) => u.email) } },
  });
  const ids = usersExisting.map((u) => u.id);

  // Clear prior seeded state for these users (but not the whole DB).
  if (ids.length > 0) {
    await prisma.bookShareEvent.deleteMany({
      where: {
        OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }],
      },
    });
    await prisma.claim.deleteMany({
      where: {
        OR: [{ ownerId: { in: ids } }, { claimerId: { in: ids } }],
      },
    });
    await prisma.userBook.deleteMany({
      where: { userId: { in: ids } },
    });
    await prisma.bookCopy.deleteMany({
      where: { originalOwnerId: { in: ids } },
    });
    await prisma.location.deleteMany({
      where: { userId: { in: ids } },
    });
    // Notes: user rows themselves stay; NextAuth uses the passwordHash and email unique constraint.
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const createdUsers = {};
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        bookCheckoutDays: u.bookCheckoutDays,
        bookReturnDays: u.bookReturnDays,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        bookCheckoutDays: u.bookCheckoutDays,
        bookReturnDays: u.bookReturnDays,
      },
    });
    createdUsers[u.key] = user;

    await prisma.location.upsert({
      where: { userId: user.id },
      update: {
        label: u.location.label,
        lat: u.location.lat,
        lng: u.location.lng,
        address: u.location.address,
      },
      create: {
        userId: user.id,
        label: u.location.label,
        lat: u.location.lat,
        lng: u.location.lng,
        address: u.location.address,
      },
    });
  }

  // Catalog books
  const harry = await prisma.book.create({
    data: {
      title: "Harry Potter and the Sorcerer's Stone",
      author: "J.K. Rowling",
      coverUrl: null,
    },
  });
  const hobbit = await prisma.book.create({
    data: {
      title: "The Hobbit",
      author: "J.R.R. Tolkien",
      coverUrl: null,
    },
  });

  // --- Copy lineage chain for Harry Potter ---
  // Copy 1: original owner = Owner A. Handed from Owner A -> Borrower B -> Borrower C.
  const copy1 = await prisma.bookCopy.create({
    data: {
      bookId: harry.id,
      originalOwnerId: createdUsers.ownerA.id,
    },
  });

  // Owner A lists a copy (becomes gone after completed pickup)
  const ubOwnerA_CompletedSource = await prisma.userBook.create({
    data: {
      userId: createdUsers.ownerA.id,
      bookId: harry.id,
      bookCopyId: copy1.id,
      status: "claimed", // will be changed to gone when we seed completion
      locationType: "my_library",
    },
    include: { book: true },
  });

  const expiresAt1 = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days from now
  const returnBy1 = new Date(Date.now() + 1000 * 60 * 60 * 24 * (createdUsers.ownerA.bookReturnDays ?? 30));

  const claim1 = await prisma.claim.create({
    data: {
      userBookId: ubOwnerA_CompletedSource.id,
      claimerId: createdUsers.borrowerB.id,
      ownerId: createdUsers.ownerA.id,
      status: "completed",
      expiresAt: expiresAt1,
      returnBy: returnBy1,
    },
  });

  // Mark source listing as gone (book picked up)
  await prisma.userBook.update({
    where: { id: ubOwnerA_CompletedSource.id },
    data: { status: "gone" },
  });

  const shareEvent1 = await prisma.bookShareEvent.create({
    data: {
      bookCopyId: copy1.id,
      fromUserId: createdUsers.ownerA.id,
      toUserId: createdUsers.borrowerB.id,
      claimId: claim1.id,
    },
  });

  // Borrower B relists the same copy for the next reader.
  const ubBorrowerB_Available = await prisma.userBook.create({
    data: {
      userId: createdUsers.borrowerB.id,
      bookId: harry.id,
      bookCopyId: copy1.id,
      status: "available",
      locationType: "my_library",
    },
  });

  const expiresAt2 = new Date(Date.now() + 1000 * 60 * 60 * 24 * 4);
  const returnBy2 = new Date(Date.now() + 1000 * 60 * 60 * 24 * (createdUsers.borrowerB.bookReturnDays ?? 30));

  const claim2 = await prisma.claim.create({
    data: {
      userBookId: ubBorrowerB_Available.id,
      claimerId: createdUsers.borrowerC.id,
      ownerId: createdUsers.borrowerB.id,
      status: "completed",
      expiresAt: expiresAt2,
      returnBy: returnBy2,
    },
  });

  await prisma.userBook.update({
    where: { id: ubBorrowerB_Available.id },
    data: { status: "gone" },
  });

  const shareEvent2 = await prisma.bookShareEvent.create({
    data: {
      bookCopyId: copy1.id,
      fromUserId: createdUsers.borrowerB.id,
      toUserId: createdUsers.borrowerC.id,
      claimId: claim2.id,
    },
  });

  // --- Copy 2: Owner A has a pending claim (owner should be able to mark book placed) ---
  const copy2 = await prisma.bookCopy.create({
    data: {
      bookId: harry.id,
      originalOwnerId: createdUsers.ownerA.id,
    },
  });

  const ubOwnerA_PendingSource = await prisma.userBook.create({
    data: {
      userId: createdUsers.ownerA.id,
      bookId: harry.id,
      bookCopyId: copy2.id,
      status: "claimed",
      locationType: "my_library",
    },
  });

  const claimPending = await prisma.claim.create({
    data: {
      userBookId: ubOwnerA_PendingSource.id,
      claimerId: createdUsers.borrowerB.id,
      ownerId: createdUsers.ownerA.id,
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    },
  });

  // --- Copy 3: Owner A has a book_placed claim (claimer should be able to pick up) ---
  const copy3 = await prisma.bookCopy.create({
    data: {
      bookId: harry.id,
      originalOwnerId: createdUsers.ownerA.id,
    },
  });
  const ubOwnerA_PlacedSource = await prisma.userBook.create({
    data: {
      userId: createdUsers.ownerA.id,
      bookId: harry.id,
      bookCopyId: copy3.id,
      status: "claimed",
      locationType: "my_library",
    },
  });

  const claimPlaced = await prisma.claim.create({
    data: {
      userBookId: ubOwnerA_PlacedSource.id,
      claimerId: createdUsers.borrowerB.id,
      ownerId: createdUsers.ownerA.id,
      status: "book_placed",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    },
  });

  // --- Copy 4: Owner A has an expired claim (should show as “Expired”, no actions) ---
  const copy4 = await prisma.bookCopy.create({
    data: {
      bookId: harry.id,
      originalOwnerId: createdUsers.ownerA.id,
    },
  });
  const ubOwnerA_ExpiredSource = await prisma.userBook.create({
    data: {
      userId: createdUsers.ownerA.id,
      bookId: harry.id,
      bookCopyId: copy4.id,
      status: "available", // expired claims put the book back as available
      locationType: "my_library",
    },
  });
  const claimExpired = await prisma.claim.create({
    data: {
      userBookId: ubOwnerA_ExpiredSource.id,
      claimerId: createdUsers.borrowerB.id,
      ownerId: createdUsers.ownerA.id,
      status: "expired",
      expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // yesterday
    },
  });

  // --- Removed listing (Owner A removed from shelf) ---
  const copy5 = await prisma.bookCopy.create({
    data: {
      bookId: hobbit.id,
      originalOwnerId: createdUsers.ownerA.id,
    },
  });
  await prisma.userBook.create({
    data: {
      userId: createdUsers.ownerA.id,
      bookId: hobbit.id,
      bookCopyId: copy5.id,
      status: "removed",
      removedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      locationType: "my_library",
    },
  });

  // --- Extra available inventory for search/distance testing ---
  // Owner D has an available Hobbit listing near Owner A.
  const copy6 = await prisma.bookCopy.create({
    data: {
      bookId: hobbit.id,
      originalOwnerId: createdUsers.ownerD.id,
    },
  });
  await prisma.userBook.create({
    data: {
      userId: createdUsers.ownerD.id,
      bookId: hobbit.id,
      bookCopyId: copy6.id,
      status: "available",
      locationType: "my_library",
    },
  });

  // Borrower C has an available Harry Potter listing far-ish away.
  const copy7 = await prisma.bookCopy.create({
    data: {
      bookId: harry.id,
      originalOwnerId: createdUsers.borrowerC.id,
    },
  });
  await prisma.userBook.create({
    data: {
      userId: createdUsers.borrowerC.id,
      bookId: harry.id,
      bookCopyId: copy7.id,
      status: "available",
      locationType: "my_library",
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
  console.log("Log in with password:", PASSWORD);
  for (const u of USERS) console.log(`${u.name}: ${u.email}`);

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  });

