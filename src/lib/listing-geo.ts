import type { Location, UserBook } from "@prisma/client";

type UserWithLocation = { location: Location | null };

/** Point where the listing is offered (lister’s library). */
export function getListingCoords(
  ub: Pick<UserBook, "locationType" | "dropLat" | "dropLng"> & { user: UserWithLocation }
): { lat: number; lng: number } | null {
  const loc = ub.user.location;
  if (loc?.lat != null && loc?.lng != null) {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}
