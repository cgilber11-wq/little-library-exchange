import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import QRCode from "qrcode";
import { authOptions } from "@/lib/auth";
import { ensureLocationPublicSlug } from "@/lib/library-public";
import { publicLibraryUrl } from "@/lib/app-url";

/** PNG QR code for the signed-in member's public library page. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const slug = await ensureLocationPublicSlug(session.user.id);
    const url = publicLibraryUrl(slug);
    const png = await QRCode.toBuffer(url, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Save your library location first" }, { status: 400 });
  }
}
