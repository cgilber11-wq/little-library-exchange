import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SearchForm, type AvailabilityFilter, type SearchTabId } from "./search-form";
import { AppHeader } from "@/components/AppHeader";

function parseTab(raw?: string): SearchTabId {
  if (raw === "looking") return "looking";
  return "search";
}

function parseFilter(tab: string | undefined, filter?: string): AvailabilityFilter {
  if (filter === "shelf" || filter === "collections") return filter;
  // Legacy tab URLs
  if (tab === "shelf" || tab === "nearby") return "shelf";
  if (tab === "lend") return "collections";
  return "all";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { tab?: string; filter?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const initialTab = parseTab(searchParams.tab);
  const initialFilter = parseFilter(searchParams.tab, searchParams.filter);

  return (
    <div className="page-shell">
      <AppHeader current="search" />

      <main className="page-main max-w-4xl">
        <h1 className="page-title mb-6 text-2xl sm:text-3xl">Find a book</h1>
        <SearchForm initialTab={initialTab} initialFilter={initialFilter} />
      </main>
    </div>
  );
}
