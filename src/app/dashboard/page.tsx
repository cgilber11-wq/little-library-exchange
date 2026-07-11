import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { expireStaleClaims } from "@/lib/expire-claims";
import { ClaimsReceived, ClaimsMade } from "./claim-actions";
import { AppHeader } from "@/components/AppHeader";
import { DashboardSection } from "@/components/DashboardSection";
import { LookingForSection } from "./looking-for-section";
import { ensureLocationPublicSlug } from "@/lib/library-public";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  await expireStaleClaims();

  const [user, userBooks, location, claimsReceived, claimsMade, introducedCount, myWishRequests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, score: true },
    }),
    prisma.userBook.findMany({
      where: { userId: session.user.id },
      select: { status: true },
    }),
    prisma.location.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.claim.findMany({
      where: { ownerId: session.user.id },
      include: {
        userBook: { include: { book: true } },
        claimer: {
          select: {
            name: true,
            email: true,
            location: { select: { publicSlug: true, publicPageEnabled: true, label: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.claim.findMany({
      where: { claimerId: session.user.id },
      include: {
        userBook: {
          include: { book: true },
        },
        owner: {
          select: {
            id: true,
            name: true,
            location: {
              select: {
                label: true,
                address: true,
                lat: true,
                lng: true,
                publicSlug: true,
                publicPageEnabled: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bookCopy.count({
      where: { originalOwnerId: session.user.id },
    }),
    prisma.bookWishRequest.findMany({
      where: { userId: session.user.id },
      include: {
        matchedUserBook: { include: { book: true, claim: true } },
        responder: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const claim of claimsMade) {
    const loc = claim.owner.location;
    if (!claim.owner.id || !loc || loc.publicSlug) continue;
    try {
      loc.publicSlug = await ensureLocationPublicSlug(claim.owner.id);
      if (loc.publicPageEnabled == null) loc.publicPageEnabled = true;
    } catch {
      // Owner has no saved location.
    }
  }

  const activeInCollection = userBooks.filter((ub) => ub.status === "available" || ub.status === "claimed");

  const locationLine =
    location?.label?.trim() ||
    location?.address?.trim() ||
    (location ? "Saved on map" : null);

  const activeReservationsIn = claimsReceived.filter((c) => c.status === "pending" || c.status === "book_placed").length;
  const activePickupsOut = claimsMade.filter((c) => c.status === "pending" || c.status === "book_placed").length;

  const exchangeCount = user?.score ?? 0;

  return (
    <div className="page-shell">
      <AppHeader current="dashboard" />

      <main className="page-main max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="page-title text-2xl sm:text-3xl">
              Welcome back, {user?.name || "reader"}
            </h1>
            <div className="mt-2">
              {location ? (
                <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-stone-600">
                  <MapPinIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate" title={locationLine ?? undefined}>{locationLine}</span>
                  <span className="text-stone-300">·</span>
                  <Link href="/dashboard/location" className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline shrink-0">
                    Edit
                  </Link>
                  <span className="text-stone-300">·</span>
                  <Link href="/dashboard/library-page" className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline shrink-0">
                    Profile
                  </Link>
                </span>
              ) : (
                <Link
                  href="/dashboard/location"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800 hover:text-amber-950 hover:underline"
                >
                  <MapPinIcon className="h-4 w-4 shrink-0" />
                  Add location
                </Link>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/add"
            className="btn-primary shrink-0 gap-1.5 !px-4"
          >
            <span aria-hidden className="text-base leading-none">+</span> Add book
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Exchanges"
            value={exchangeCount}
            icon={<OpenBookHeartIcon className="h-5 w-5" />}
          />
          <StatCard
            label="Reservations"
            value={activeReservationsIn}
            icon={<InboxIcon className="h-5 w-5" />}
            href="/dashboard#reservations-in"
          />
          <StatCard
            label="Pickups"
            value={activePickupsOut}
            icon={<HandoffIcon className="h-5 w-5" />}
            href="/dashboard#pickups-out"
          />
          <StatCard
            label="Collection"
            value={activeInCollection.length}
            icon={<BookStackIcon className="h-5 w-5" />}
            href="/dashboard/books"
          />
          <StatCard
            label="Introduced"
            value={introducedCount}
            icon={<BookStackIcon className="h-5 w-5" />}
            href="/dashboard/introduced"
          />
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <DashboardSection sectionId="reservations-in" title="Reservations">
              <ClaimsReceived claims={claimsReceived} />
            </DashboardSection>

            <DashboardSection sectionId="pickups-out" title="Pickups">
              <ClaimsMade claims={claimsMade} />
            </DashboardSection>
          </div>

          <DashboardSection sectionId="looking-for" title="Looking for">
            <LookingForSection wishes={myWishRequests} />
          </DashboardSection>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
        {icon ? <span className="shrink-0 text-emerald-600" aria-hidden>{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block cozy-card p-4 transition-colors hover:border-emerald-300/80 hover:bg-emerald-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="cozy-card p-4">{inner}</div>
  );
}

function OpenBookHeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 11.5c.5-.5 1.2-.8 2-.8s1.5.3 2 .8"
        opacity="0.85"
      />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l1.5 3h5L16 13h4M4 13l2.5-7h11L20 13M4 13v5a1 1 0 001 1h14a1 1 0 001-1v-5" />
    </svg>
  );
}

function HandoffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h11l-3-3M20 16H9l3 3" />
    </svg>
  );
}

function BookStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8-3 8 3-8 3-8-3zM4 12l8 3 8-3M4 17l8 3 8-3" />
    </svg>
  );
}
