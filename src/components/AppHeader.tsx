import Link from "next/link";
import { Brand } from "./Brand";
import { AlertsBell } from "./AlertsBell";

export type AppNavId = "dashboard" | "search" | "books" | "about" | "settings" | "introduced";

const AUTH_NAV: { id: AppNavId; href: string; label: string }[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard" },
  { id: "search", href: "/search", label: "Find a book" },
  { id: "books", href: "/dashboard/books", label: "My books" },
  { id: "about", href: "/about", label: "About" },
  { id: "settings", href: "/dashboard/settings", label: "Settings" },
];

function navLinkClass(isCurrent: boolean) {
  return [
    "inline-flex shrink-0 items-center border-b-2 px-0.5 py-1 text-sm transition-colors",
    isCurrent
      ? "border-emerald-600 font-semibold text-emerald-800"
      : "border-transparent font-medium text-stone-600 hover:border-stone-200 hover:text-emerald-800",
  ].join(" ");
}

type AppHeaderProps = {
  current?: AppNavId | null;
  authenticated?: boolean;
  back?: { href: string; label: string };
};

export function AppHeader({ current = null, authenticated = true, back }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {back ? (
          <Link
            href={back.href}
            className="inline-block pt-2.5 text-sm font-medium text-emerald-800 hover:text-emerald-900 hover:underline"
          >
            ← {back.label}
          </Link>
        ) : null}
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <Brand href="/" className="min-w-0 shrink" />
          <nav
            className="flex min-w-0 items-center gap-x-3 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-x-5 [&::-webkit-scrollbar]:hidden"
            aria-label="Main"
          >
            {authenticated ? (
              <>
                <AlertsBell />
                {AUTH_NAV.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={navLinkClass(current === item.id)}
                    aria-current={current === item.id ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/api/auth/signout"
                  className="inline-flex shrink-0 items-center py-1 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800"
                >
                  Sign out
                </Link>
              </>
            ) : (
              <>
                <Link href="/about" className={navLinkClass(current === "about")}>
                  About
                </Link>
                <Link
                  href="/login"
                  className="inline-flex shrink-0 items-center py-1 text-sm font-medium text-stone-600 transition-colors hover:text-emerald-800"
                >
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary !px-4 !py-2 text-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
