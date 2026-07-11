import { prisma } from "@/lib/prisma";

export type AlertKind = "request" | "placed" | "pickup" | "complete" | "expired";

export type AlertItem = {
  id: string;
  kind: AlertKind;
  title: string;
  detail: string;
  href: string;
  /** ISO timestamp for sorting / display */
  at: string;
  urgent?: boolean;
};

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Recent activity derived from claims involving the user (requests, placed, pickup, completed, expired).
 */
export async function getRecentAlerts(userId: string): Promise<AlertItem[]> {
  const since = new Date(Date.now() - LOOKBACK_MS);

  const claims = await prisma.claim.findMany({
    where: {
      AND: [
        { OR: [{ ownerId: userId }, { claimerId: userId }] },
        { OR: [{ updatedAt: { gte: since } }, { createdAt: { gte: since } }] },
      ],
    },
    include: {
      userBook: { include: { book: true } },
      claimer: { select: { name: true, email: true } },
      owner: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  const now = Date.now();
  const out: AlertItem[] = [];

  for (const c of claims) {
    const book = c.userBook.book.title;
    const isOwner = c.ownerId === userId;

    if (isOwner) {
      if (c.status === "pending") {
        const who = c.claimer.name || c.claimer.email?.split("@")[0] || "Someone";
        out.push({
          id: `claim:${c.id}:pending`,
          kind: "request",
          title: "New reservation",
          detail: `${who} reserved “${book}”.`,
          href: "/dashboard#reservations-in",
          at: c.createdAt.toISOString(),
        });
      } else if (c.status === "book_placed") {
        out.push({
          id: `claim:${c.id}:placed`,
          kind: "placed",
          title: "Book placed for pickup",
          detail: `You left “${book}” in the little library — waiting for pickup.`,
          href: "/dashboard#reservations-in",
          at: c.updatedAt.toISOString(),
        });
      } else if (c.status === "completed") {
        out.push({
          id: `claim:${c.id}:completed`,
          kind: "complete",
          title: "Pickup complete",
          detail: `“${book}” was picked up. +1 exchange.`,
          href: "/dashboard#reservations-in",
          at: c.updatedAt.toISOString(),
        });
      } else if (c.status === "expired") {
        out.push({
          id: `claim:${c.id}:expired`,
          kind: "expired",
          title: "Reservation expired",
          detail: `The reservation for “${book}” timed out.`,
          href: "/dashboard#reservations-in",
          at: c.updatedAt.toISOString(),
        });
      }
    } else {
      const ownerName = c.owner.name || "the owner";
      if (c.status === "pending") {
        out.push({
          id: `claim:${c.id}:pending`,
          kind: "request",
          title: "Reservation sent",
          detail: `Waiting for ${ownerName} to place “${book}”.`,
          href: "/dashboard#pickups-out",
          at: c.createdAt.toISOString(),
        });
      } else if (c.status === "book_placed") {
        const exp = c.expiresAt ? new Date(c.expiresAt).getTime() : 0;
        const urgent = exp > 0 && exp - now < 48 * 60 * 60 * 1000;
        out.push({
          id: `claim:${c.id}:placed`,
          kind: "pickup",
          title: "Ready for pickup",
          detail: `“${book}” is waiting — pick it up before the window closes.`,
          href: "/dashboard#pickups-out",
          at: c.updatedAt.toISOString(),
          urgent,
        });
      } else if (c.status === "completed") {
        out.push({
          id: `claim:${c.id}:completed`,
          kind: "complete",
          title: "Handoff complete",
          detail: `You picked up “${book}”. Enjoy reading!`,
          href: "/dashboard#pickups-out",
          at: c.updatedAt.toISOString(),
        });
      } else if (c.status === "expired") {
        out.push({
          id: `claim:${c.id}:expired`,
          kind: "expired",
          title: "Reservation expired",
          detail: `Your reservation for “${book}” timed out.`,
          href: "/dashboard#pickups-out",
          at: c.updatedAt.toISOString(),
        });
      }
    }
  }

  out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return out.slice(0, 30);
}
