export type ListingAvailabilityKind = "shelf" | "lend";

export function listingAvailabilityKind(locationType: string): ListingAvailabilityKind {
  if (locationType === "my_library") return "shelf";
  return "lend";
}

export function isOnShelfListing(locationType: string) {
  return locationType === "my_library";
}

export function isLendListing(locationType: string) {
  return locationType === "collection";
}

/** Short badge label for search / browse results. */
export function availabilityBadgeLabel(kind: ListingAvailabilityKind) {
  return kind === "shelf" ? "On the shelf" : "Collection";
}

export const ASK_TO_PLACE_LABEL = "Ask to place in library";

export function reserveSuccessMessage() {
  return "Request sent.";
}

/** Sort shelf listings before collection, then by distance. */
export function compareSearchResults(
  a: { locationType: string; distanceMiles?: number | null },
  b: { locationType: string; distanceMiles?: number | null },
) {
  const rank = (lt: string) => (lt === "my_library" ? 0 : 1);
  const dr = rank(a.locationType) - rank(b.locationType);
  if (dr !== 0) return dr;
  const da = a.distanceMiles ?? 1e9;
  const db = b.distanceMiles ?? 1e9;
  return da - db;
}
