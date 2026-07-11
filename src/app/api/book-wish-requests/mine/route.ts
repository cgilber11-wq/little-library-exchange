import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET: current user’s book requests (all statuses) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.bookWishRequest.findMany({
    where: { userId: session.user.id },
    include: {
      matchedUserBook: {
        include: {
          book: true,
          user: { select: { name: true, id: true } },
          claim: true,
        },
      },
      responder: { select: { name: true, id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    requests: items,
    openCount: items.filter((x) => x.status === "open").length,
  });
}
