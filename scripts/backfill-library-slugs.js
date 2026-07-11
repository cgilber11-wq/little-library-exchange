/**
 * One-time backfill: assign publicSlug to every Location row missing one.
 * Run: node scripts/backfill-library-slugs.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SLUG_MAX = 48;

function slugifyLabel(label) {
  const base = String(label)
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

async function allocatePublicSlug(hint) {
  const fromHint = hint ? slugifyLabel(hint) : "";
  const candidates = [
    fromHint,
    fromHint ? `${fromHint}-${randomSuffix()}` : "",
    `library-${randomSuffix()}`,
  ].filter(Boolean);

  for (const slug of candidates) {
    const taken = await prisma.location.findUnique({ where: { publicSlug: slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `library-${Date.now().toString(36)}`;
}

async function main() {
  const rows = await prisma.location.findMany({
    where: { OR: [{ publicSlug: null }, { publicSlug: "" }] },
    select: { id: true, label: true, address: true },
  });

  let updated = 0;
  for (const row of rows) {
    const slug = await allocatePublicSlug(row.label ?? row.address);
    await prisma.location.update({ where: { id: row.id }, data: { publicSlug: slug } });
    updated += 1;
    console.log(`  ${row.label || row.address || row.id} → /library/${slug}`);
  }

  console.log(updated ? `Backfilled ${updated} library slug(s).` : "All locations already have slugs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
