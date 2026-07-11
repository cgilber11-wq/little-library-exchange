import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allocatePublicSlug, ensureLocationPublicSlug } from "@/lib/library-public";
import { publicLibraryUrl } from "@/lib/app-url";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let location = await prisma.location.findUnique({
    where: { userId: session.user.id },
  });
  if (location && !location.publicSlug) {
    await ensureLocationPublicSlug(session.user.id);
    location = await prisma.location.findUnique({ where: { userId: session.user.id } });
  }
  const slug = location?.publicSlug ?? null;
  return NextResponse.json({
    ...location,
    publicUrl: slug ? publicLibraryUrl(slug) : null,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { label, lat, lng, address } = body;
    const location = await prisma.location.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        label: label ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        address: address ?? null,
        publicSlug: await allocatePublicSlug(label ?? address),
      },
      update: {
        label: label ?? undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        address: address ?? undefined,
      },
    });
    let slug = location.publicSlug;
    if (!slug) {
      slug = await ensureLocationPublicSlug(session.user.id);
    }
    const updated = await prisma.location.findUnique({ where: { userId: session.user.id } });
    return NextResponse.json({
      ...updated,
      publicUrl: slug ? publicLibraryUrl(slug) : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    shareCollectionOnPublicPage?: boolean;
    publicPageEnabled?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "verify_library") {
    try {
      const now = new Date();
      const location = await prisma.location.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          libraryLastVerifiedAt: now,
          publicSlug: await allocatePublicSlug("library"),
        },
        update: {
          libraryLastVerifiedAt: now,
        },
      });
      return NextResponse.json(location);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Failed to save library verification" }, { status: 500 });
    }
  }

  if (typeof body.shareCollectionOnPublicPage === "boolean" || typeof body.publicPageEnabled === "boolean") {
    try {
      const slug = await ensureLocationPublicSlug(session.user.id);
      const location = await prisma.location.update({
        where: { userId: session.user.id },
        data: {
          ...(typeof body.shareCollectionOnPublicPage === "boolean"
            ? { shareCollectionOnPublicPage: body.shareCollectionOnPublicPage }
            : {}),
          ...(typeof body.publicPageEnabled === "boolean" ? { publicPageEnabled: body.publicPageEnabled } : {}),
        },
      });
      return NextResponse.json({
        ...location,
        publicUrl: publicLibraryUrl(slug),
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Save a library location first" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
