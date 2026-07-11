import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { expireStaleClaims } from "@/lib/expire-claims";
import { getRecentAlerts } from "@/lib/alerts";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await expireStaleClaims();
  const alerts = await getRecentAlerts(session.user.id);
  return NextResponse.json({ alerts });
}
