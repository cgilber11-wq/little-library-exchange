import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_DAYS = 1;
const MAX_DAYS = 365;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bookCheckoutDays: true, bookReturnDays: true },
  });
  return NextResponse.json({
    bookCheckoutDays: user?.bookCheckoutDays ?? 14,
    bookReturnDays: user?.bookReturnDays ?? 30,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { bookCheckoutDays?: unknown; bookReturnDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { bookCheckoutDays?: number; bookReturnDays?: number } = {};

  if (body.bookCheckoutDays !== undefined) {
    const days = Number(body.bookCheckoutDays);
    if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
      return NextResponse.json(
        { error: `bookCheckoutDays must be an integer between ${MIN_DAYS} and ${MAX_DAYS}` },
        { status: 400 }
      );
    }
    updates.bookCheckoutDays = days;
  }

  if (body.bookReturnDays !== undefined) {
    const rDays = Number(body.bookReturnDays);
    if (!Number.isInteger(rDays) || rDays < MIN_DAYS || rDays > MAX_DAYS) {
      return NextResponse.json(
        { error: `bookReturnDays must be an integer between ${MIN_DAYS} and ${MAX_DAYS}` },
        { status: 400 }
      );
    }
    updates.bookReturnDays = rDays;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Provide bookCheckoutDays and/or bookReturnDays" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updates,
    select: { bookCheckoutDays: true, bookReturnDays: true },
  });
  return NextResponse.json({
    bookCheckoutDays: user.bookCheckoutDays,
    bookReturnDays: user.bookReturnDays,
  });
}
