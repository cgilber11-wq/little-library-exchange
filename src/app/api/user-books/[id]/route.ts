import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ub = await prisma.userBook.findUnique({ where: { id } });
  if (!ub || ub.userId !== session.user.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (body.action === "remove_from_collection") {
    if (ub.status !== "available") {
      return NextResponse.json(
        { error: "Only available listings can be removed. Cancel an open claim first if the book is reserved." },
        { status: 400 }
      );
    }
    const updated = await prisma.userBook.update({
      where: { id },
      data: { status: "removed", removedAt: new Date(), libraryPlacedAt: null },
      include: { book: true },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "add_to_little_library") {
    if (ub.status !== "available") {
      return NextResponse.json(
        { error: "Only available books can be added to your little library." },
        { status: 400 }
      );
    }
    if (ub.locationType === "my_library") {
      return NextResponse.json({ error: "This book is already on your little library shelf." }, { status: 400 });
    }
    const updated = await prisma.userBook.update({
      where: { id },
      data: {
        locationType: "my_library",
        libraryPlacedAt: new Date(),
        dropLabel: null,
        dropLat: null,
        dropLng: null,
      },
      include: { book: true },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "remove_from_little_library") {
    if (ub.status !== "available") {
      return NextResponse.json(
        { error: "Only available books can be removed from your little library shelf." },
        { status: 400 }
      );
    }
    if (ub.locationType !== "my_library") {
      return NextResponse.json({ error: "This book is not on your little library shelf." }, { status: 400 });
    }
    const updated = await prisma.userBook.update({
      where: { id },
      data: {
        locationType: "collection",
        libraryPlacedAt: null,
      },
      include: { book: true },
    });
    return NextResponse.json(updated);
  }

  /** Put a listing back under “Books in my library” (was manually removed, or marked as physically returned after a handoff). */
  if (body.action === "back_to_my_books" || body.action === "restore_to_collection") {
    if (ub.status !== "removed" && ub.status !== "gone") {
      return NextResponse.json(
        { error: "Only items in “no longer in my collection” can be added back" },
        { status: 400 }
      );
    }

    if (ub.bookCopyId) {
      const otherActive = await prisma.userBook.findFirst({
        where: {
          bookCopyId: ub.bookCopyId,
          status: { in: ["available", "claimed"] },
          id: { not: ub.id },
        },
      });
      if (otherActive) {
        return NextResponse.json(
          {
            error:
              "This copy already has an active listing in the app (someone else may be sharing it). You can’t add this row back until that listing is gone.",
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.userBook.update({
      where: { id },
      data: { status: "available", removedAt: null },
      include: { book: true },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
