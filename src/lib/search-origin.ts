import { prisma } from "@/lib/prisma";

export type OriginResult = {
  originLat: number | null;
  originLng: number | null;
  originSource: "query" | "saved" | null;
};

/**
 * Resolve search / wishlist distance origin: query lat/lng, else viewer’s saved library.
 */
export async function resolveSearchOrigin(
  userId: string,
  qLat: string | null,
  qLng: string | null
): Promise<OriginResult> {
  let originLat: number | null = null;
  let originLng: number | null = null;
  let originSource: "query" | "saved" | null = null;

  if (qLat != null && qLng != null && qLat !== "" && qLng !== "") {
    const la = Number(qLat);
    const ln = Number(qLng);
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      originLat = la;
      originLng = ln;
      originSource = "query";
    }
  }

  if ((originLat == null || originLng == null) && userId) {
    const me = await prisma.location.findUnique({
      where: { userId },
      select: { lat: true, lng: true },
    });
    if (me?.lat != null && me?.lng != null) {
      originLat = me.lat;
      originLng = me.lng;
      originSource = "saved";
    }
  }

  return { originLat, originLng, originSource };
}
