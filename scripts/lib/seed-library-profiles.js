/** Shared library profile fields for seed / demo data. */

const SEED_LIBRARY_PHOTOS = {
  jordan: "/seed-libraries/jordan.svg",
  casey: "/seed-libraries/casey.svg",
  morgan: "/seed-libraries/morgan.svg",
  sam: "/seed-libraries/sam.svg",
  riley: "/seed-libraries/riley.svg",
  default: "/seed-libraries/my-library.svg",
  generic: "/seed-libraries/generic.svg",
};

const SEED_LIBRARY_PHOTO_KEYS = ["jordan", "casey", "morgan", "sam", "riley", "default"];

/** Stable pixel-art pick for bulk seed users (re-seeding keeps the same art). */
function pickSeedPhotoKey(seed) {
  const s = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash + s.charCodeAt(i) * (i + 1)) % SEED_LIBRARY_PHOTO_KEYS.length;
  }
  return SEED_LIBRARY_PHOTO_KEYS[hash];
}

function slugifyLabel(label) {
  const base = String(label)
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "little-library";
}

/**
 * @param {object} opts
 * @param {string} [opts.key] - jordan | casey | morgan | sam | riley
 * @param {string} opts.label
 * @param {string} [opts.publicSlug] - explicit slug (must be unique)
 * @param {boolean} [opts.shareCollectionOnPublicPage]
 */
function libraryProfileSeedFields({ key, label, publicSlug, shareCollectionOnPublicPage = true }) {
  return {
    publicSlug: publicSlug ?? slugifyLabel(label),
    publicPageEnabled: true,
    shareCollectionOnPublicPage,
    photoUrl: (key && SEED_LIBRARY_PHOTOS[key]) || SEED_LIBRARY_PHOTOS.default,
  };
}

/** Neighbor slug scoped to a target account so re-seeding stays unique. */
function neighborProfileSlug(neighborKey, accountIdSuffix) {
  const suffix = accountIdSuffix.replace(/^\./, "");
  return `${neighborKey}-${suffix}`;
}

module.exports = {
  SEED_LIBRARY_PHOTOS,
  SEED_LIBRARY_PHOTO_KEYS,
  slugifyLabel,
  libraryProfileSeedFields,
  neighborProfileSlug,
  pickSeedPhotoKey,
};
