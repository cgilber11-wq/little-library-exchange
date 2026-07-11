import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distanceMiles } from "@/lib/geo";
import { resolveSearchOrigin } from "@/lib/search-origin";

const MAX_OPEN_WISHES = 5;

/** GET: community wishlist (open requests from others). Query: lat, lng, maxMiles */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const maxMilesRaw = searchParams.get("maxMiles");
  const maxMiles =
    maxMilesRaw != null && maxMilesRaw !== ""
      ? Math.min(500, Math.max(1, Number(maxMilesRaw)))
      : null;

  const { originLat, originLng, originSource } = await resolveSearchOrigin(
    session.user.id,
    searchParams.get("lat"),
    searchParams.get("lng")
  );

  const distanceFilterActive = maxMiles != null && Number.isFinite(maxMiles);

  if (distanceFilterActive && (originLat == null || originLng == null)) {
    return NextResponse.json(
      {
        error:
          "Add coordinates to your library location or use device location on this page to filter by distance.",
        results: [],
        distanceFilterSkipped: true,
      },
      { status: 400 }
    );
  }

  const wishes = await prisma.bookWishRequest.findMany({
    where: { status: "open", userId: { not: session.user.id } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          score: true,
          location: { select: { lat: true, lng: true, label: true } },
        },
      },
    },
    take: 300,
    orderBy: { createdAt: "desc" },
  });

  const rows = wishes
    .map((w) => {
      const loc = w.user.location;
      const hasCoords = loc?.lat != null && loc?.lng != null;
      const dist =
        hasCoords && originLat != null && originLng != null
          ? distanceMiles(originLat, originLng, loc!.lat!, loc!.lng!)
          : null;
      return {
        id: w.id,
        title: w.title,
        author: w.author,
        note: w.note,
        createdAt: w.createdAt.toISOString(),
        requester: {
          id: w.user.id,
          name: w.user.name,
          exchangeCount: w.user.score,
        },
        distanceMiles: dist,
        requesterHasCoords: hasCoords,
      };
    })
    .filter((r) => {
      if (!distanceFilterActive) return true;
      if (r.distanceMiles == null) return false;
      return r.distanceMiles <= maxMiles!;
    })
    .sort((a, b) => {
      const da = a.distanceMiles ?? 1e9;
      const db = b.distanceMiles ?? 1e9;
      return da - db;
    });

  return NextResponse.json({
    results: rows,
    origin:
      originLat != null && originLng != null
        ? { lat: originLat, lng: originLng, source: originSource }
        : null,
    maxMiles: distanceFilterActive ? maxMiles : null,
    distanceFilterActive,
  });
}

/** POST: create a wish (max 5 open) */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; author?: string | null; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 500) {
    return NextResponse.json({ error: "Title is required (max 500 characters)." }, { status: 400 });
  }
  const author = typeof body.author === "string" ? body.author.trim() || null : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const openCount = await prisma.bookWishRequest.count({
    where: { userId: session.user.id, status: "open" },
  });
  if (openCount >= MAX_OPEN_WISHES) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_OPEN_WISHES} open book requests. Remove or wait for a match first.` },
      { status: 400 }
    );
  }

  const created = await prisma.bookWishRequest.create({
    data: {
      userId: session.user.id,
      title,
      author,
      note,
    },
  });

  return NextResponse.json(created);
}
