/** Google Maps directions URL (opens the Maps app on mobile). */
export function googleMapsDirectionsUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  label?: string | null;
}): string | null {
  const { lat, lng, address, label } = opts;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const dest = address?.trim() || label?.trim();
  if (dest) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }
  return null;
}

/** Google Maps place search (view on map, easy to share). */
export function googleMapsSearchUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  label?: string | null;
}): string | null {
  const { lat, lng, address, label } = opts;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const q = address?.trim() || label?.trim();
  if (q) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  return null;
}

export type PickupSpot = {
  label: string | null;
  lat: number | null;
  lng: number | null;
  locationType: string;
  directionsUrl: string | null;
  mapUrl: string | null;
};

export function getPickupSpot(
  userBook: {
    locationType: string;
    dropLabel: string | null;
    dropLat: number | null;
    dropLng: number | null;
  },
  ownerLocation: {
    label: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  } | null,
): PickupSpot {
  let label: string | null;
  let lat: number | null = null;
  let lng: number | null = null;
  let address: string | null = null;

  const loc = ownerLocation;
  label = loc?.label?.trim() || loc?.address?.trim() || null;
  address = loc?.address?.trim() || null;
  lat = loc?.lat ?? null;
  lng = loc?.lng ?? null;

  const mapsOpts = { lat, lng, address, label };
  return {
    label,
    lat,
    lng,
    locationType: userBook.locationType,
    directionsUrl: googleMapsDirectionsUrl(mapsOpts),
    mapUrl: googleMapsSearchUrl(mapsOpts),
  };
}
