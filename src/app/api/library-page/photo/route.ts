import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteLibraryPhoto, saveLibraryPhoto } from "@/lib/library-photo";
import { ensureLocationPublicSlug } from "@/lib/library-public";
import { publicLibraryUrl } from "@/lib/app-url";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo to upload" }, { status: 400 });
  }

  try {
    await ensureLocationPublicSlug(session.user.id);
    const existing = await prisma.location.findUnique({
      where: { userId: session.user.id },
      select: { photoUrl: true },
    });
    const photoUrl = await saveLibraryPhoto(session.user.id, file, existing?.photoUrl);
    const location = await prisma.location.update({
      where: { userId: session.user.id },
      data: { photoUrl },
    });
    const slug = location.publicSlug;
    return NextResponse.json({
      ...location,
      publicUrl: slug ? publicLibraryUrl(slug) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to upload photo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.location.findUnique({
      where: { userId: session.user.id },
      select: { photoUrl: true },
    });
    await deleteLibraryPhoto(session.user.id, existing?.photoUrl);
    const location = await prisma.location.update({
      where: { userId: session.user.id },
      data: { photoUrl: null },
    });
    const slug = location.publicSlug;
    return NextResponse.json({
      ...location,
      publicUrl: slug ? publicLibraryUrl(slug) : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to remove photo" }, { status: 500 });
  }
}
