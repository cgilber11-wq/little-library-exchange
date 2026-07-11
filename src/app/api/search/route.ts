import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleClaims } from "@/lib/expire-claims";
import { distanceMiles } from "@/lib/geo";
import { getListingCoords } from "@/lib/listing-geo";
import { compareSearchResults, listingAvailabilityKind } from "@/lib/listing-availability";

type SearchMode = "search" | "shelf" | "lend" | "all";

function parseMode(raw: string | null): SearchMode {
  if (raw === "shelf" || raw === "nearby") return "shelf";
  if (raw === "lend") return "lend";
  if (raw === "all") return "all";
  return "search";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await expireStaleClaims();

  const { searchParams } = new URL(request.url);
  const mode = parseMode(searchParams.get("mode"));
  const q = searchParams.get("q")?.trim();
  const includeMine = searchParams.get("includeMine") === "1" || searchParams.get("includeMine") === "true";

  const maxMilesRaw = searchParams.get("maxMiles");
  const maxMiles =
    maxMilesRaw != null && maxMilesRaw !== ""
      ? Math.min(500, Math.max(1, Number(maxMilesRaw)))
      : null;

  const qLat = searchParams.get("lat");
  const qLng = searchParams.get("lng");
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

  if ((originLat == null || originLng == null) && session.user.id) {
    const me = await prisma.location.findUnique({
      where: { userId: session.user.id },
      select: { lat: true, lng: true },
    });
    if (me?.lat != null && me?.lng != null) {
      originLat = me.lat;
      originLng = me.lng;
      originSource = "saved";
    }
  }

  const isBrowseMode = mode === "shelf" || mode === "lend" || mode === "all";
  const effectiveMaxMiles = isBrowseMode ? (maxMiles ?? 25) : maxMiles;
  const distanceFilterActive = effectiveMaxMiles != null && Number.isFinite(effectiveMaxMiles);

  if (distanceFilterActive && (originLat == null || originLng == null)) {
    return NextResponse.json(
      {
        error:
          "Add a library location or use current location to filter by distance.",
        results: [],
        distanceFilterSkipped: true,
      },
      { status: 400 },
    );
  }

  if (mode === "search" && !q) {
    return NextResponse.json({
      results: [],
      mode,
      origin:
        originLat != null && originLng != null
          ? { lat: originLat, lng: originLng, source: originSource }
          : null,
      maxMiles: effectiveMaxMiles,
      distanceFilterActive: !!distanceFilterActive,
    });
  }

  const sharedAvailabilityOr = [
    { locationType: "my_library" },
    {
      locationType: "collection",
      user: {
        OR: [{ location: { is: null } }, { location: { shareCollectionOnPublicPage: true } }],
      },
    },
  ];

  const where: Record<string, unknown> = {
    status: "available",
    ...(includeMine ? {} : { userId: { not: session.user.id } }),
  };

  if (mode === "shelf") {
    where.locationType = "my_library";
  } else if (mode === "lend") {
    where.locationType = "collection";
    where.user = {
      OR: [{ location: { is: null } }, { location: { shareCollectionOnPublicPage: true } }],
    };
  }

  if (mode === "search" || mode === "all") {
    where.OR = sharedAvailabilityOr;
  }

  if (q) {
    where.book = {
      OR: [{ title: { contains: q } }, { author: { contains: q } }],
    };
  }

  const userBooks = await prisma.userBook.findMany({
    where,
    include: {
      book: true,
      user: {
        select: {
          id: true,
          name: true,
          score: true,
          location: true,
        },
      },
      bookCopy: { include: { _count: { select: { shareEvents: true } } } },
    },
    take: 300,
  });

  const rows = userBooks
    .map((ub) => {
      const pt = getListingCoords(ub);
      const hasCoords = pt != null;
      const dist =
        hasCoords && originLat != null && originLng != null
          ? distanceMiles(originLat, originLng, pt.lat, pt.lng)
          : null;
      const handoffCount = ub.bookCopy?._count.shareEvents ?? 0;
      const ownerExchangeCount = ub.user.score ?? 0;
      return { ub, dist, hasCoords, handoffCount, ownerExchangeCount };
    })
    .filter((r) => {
      if (!distanceFilterActive) return true;
      return r.dist != null && r.dist <= effectiveMaxMiles!;
    });

  if (isBrowseMode) {
    rows.sort((a, b) => {
      if (b.handoffCount !== a.handoffCount) return b.handoffCount - a.handoffCount;
      if (b.ownerExchangeCount !== a.ownerExchangeCount) return b.ownerExchangeCount - a.ownerExchangeCount;
      if (a.dist == null && b.dist == null) return 0;
      if (a.dist == null) return 1;
      if (b.dist == null) return -1;
      return a.dist - b.dist;
    });
  } else if (originLat != null && originLng != null) {
    rows.sort((a, b) =>
      compareSearchResults(
        { locationType: a.ub.locationType, distanceMiles: a.dist },
        { locationType: b.ub.locationType, distanceMiles: b.dist },
      ),
    );
  }

  const top = rows.slice(0, 20);

  const results = top.map((r) => ({
    id: r.ub.id,
    book: r.ub.book,
    status: r.ub.status,
    locationType: r.ub.locationType,
    availabilityKind: listingAvailabilityKind(r.ub.locationType),
    dropLabel: r.ub.dropLabel,
    owner: { id: r.ub.user.id, name: r.ub.user.name },
    ownerExchangeCount: r.ownerExchangeCount,
    isOwnListing: r.ub.userId === session.user.id,
    handoffCount: r.handoffCount,
    distanceMiles: r.dist,
    listingHasCoords: r.hasCoords,
  }));

  return NextResponse.json({
    results,
    mode,
    origin:
      originLat != null && originLng != null
        ? { lat: originLat, lng: originLng, source: originSource }
        : null,
    maxMiles: effectiveMaxMiles,
    distanceFilterActive: !!distanceFilterActive,
  });
}
