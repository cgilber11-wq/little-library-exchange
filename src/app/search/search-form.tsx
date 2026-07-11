"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASK_TO_PLACE_LABEL,
  availabilityBadgeLabel,
  listingAvailabilityKind,
  reserveSuccessMessage,
  type ListingAvailabilityKind,
} from "@/lib/listing-availability";
import { SearchDistanceFilters } from "./search-distance-filters";
import { WishlistTab } from "./wishlist-tab";

type Hit = {
  id: string;
  book: { title: string; author: string | null; coverUrl: string | null };
  locationType: string;
  availabilityKind?: ListingAvailabilityKind;
  owner: { name: string | null; id: string };
  isOwnListing?: boolean;
  ownerExchangeCount?: number;
  distanceMiles?: number | null;
};

export type SearchTabId = "search" | "looking";
export type AvailabilityFilter = "all" | "shelf" | "collections";

const FILTER_OPTIONS: { id: AvailabilityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shelf", label: "On the shelf" },
  { id: "collections", label: "Collection" },
];

type Props = {
  initialTab?: SearchTabId;
  initialFilter?: AvailabilityFilter;
};

export function SearchForm({ initialTab = "search", initialFilter = "all" }: Props) {
  const router = useRouter();
  const [tab, setTabState] = useState<SearchTabId>(initialTab);
  const [filter, setFilter] = useState<AvailabilityFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [maxMiles, setMaxMiles] = useState("");
  const [locationReady, setLocationReady] = useState(false);
  const [savedHasCoords, setSavedHasCoords] = useState(false);
  const [useDeviceLocation, setUseDeviceLocation] = useState(false);
  const [deviceLat, setDeviceLat] = useState<number | null>(null);
  const [deviceLng, setDeviceLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ maxMiles: number | null } | null>(null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const runIdRef = useRef(0);

  const isBrowseMode =
    filter === "shelf" || filter === "collections" || (filter === "all" && !query.trim());
  const hasOrigin =
    savedHasCoords || (useDeviceLocation && deviceLat != null && deviceLng != null);

  useEffect(() => {
    setTabState(initialTab);
    setFilter(initialFilter);
  }, [initialTab, initialFilter]);

  function selectTab(next: SearchTabId) {
    setTabState(next);
    setMessage(null);
    setNeedsLocation(false);
    const params = new URLSearchParams();
    if (next === "looking") params.set("tab", "looking");
    else if (filter !== "all") params.set("filter", filter);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }

  function selectFilter(next: AvailabilityFilter) {
    setFilter(next);
    setMessage(null);
    setNeedsLocation(false);
    const params = new URLSearchParams();
    if (tab === "looking") params.set("tab", "looking");
    else if (next !== "all") params.set("filter", next);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }

  useEffect(() => {
    fetch("/api/location")
      .then((r) => r.json())
      .then((loc) => setSavedHasCoords(loc?.lat != null && loc?.lng != null))
      .catch(() => setSavedHasCoords(false))
      .finally(() => setLocationReady(true));
  }, []);

  function requestDeviceLocation() {
    setGeoStatus(null);
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceLat(pos.coords.latitude);
        setDeviceLng(pos.coords.longitude);
        setUseDeviceLocation(true);
        setNeedsLocation(false);
      },
      () => {
        setGeoStatus("Could not read location — check browser permissions.");
        setUseDeviceLocation(false);
        setDeviceLat(null);
        setDeviceLng(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }

  function clearDeviceLocation() {
    setUseDeviceLocation(false);
    setDeviceLat(null);
    setDeviceLng(null);
    setGeoStatus(null);
  }

  function shouldRunSearch() {
    return tab !== "looking";
  }

  async function runSearch() {
    if (!shouldRunSearch()) return;

    // Browse mode needs an origin (API defaults to 25 mi). Wait for location check, then guide the user.
    if (isBrowseMode && locationReady && !hasOrigin) {
      setNeedsLocation(true);
      setResults([]);
      setSearchMeta(null);
      setMessage(null);
      setLoading(false);
      return;
    }
    if (isBrowseMode && !locationReady) {
      return;
    }

    const myRunId = ++runIdRef.current;
    setLoading(true);
    setResults([]);
    setMessage(null);
    setNeedsLocation(false);
    setSearchMeta(null);
    try {
      const params = new URLSearchParams();
      const trimmed = query.trim();
      if (trimmed) params.set("q", trimmed);
      if (filter === "shelf") params.set("mode", "shelf");
      else if (filter === "collections") params.set("mode", "lend");
      else if (filter === "all" && !trimmed) params.set("mode", "all");
      if (maxMiles) params.set("maxMiles", maxMiles);
      if (useDeviceLocation && deviceLat != null && deviceLng != null) {
        params.set("lat", String(deviceLat));
        params.set("lng", String(deviceLng));
      }
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (myRunId !== runIdRef.current) return;
      if (!res.ok) {
        if (data.distanceFilterSkipped) {
          setNeedsLocation(true);
          setMessage(null);
        } else {
          setMessage({ type: "err", text: data.error || "Search failed" });
        }
        return;
      }
      setResults(data.results ?? []);
      setSearchMeta({ maxMiles: data.maxMiles ?? null });
    } catch {
      if (myRunId !== runIdRef.current) return;
      setMessage({ type: "err", text: "Search failed" });
    } finally {
      if (myRunId === runIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!shouldRunSearch()) {
      setResults([]);
      setSearchMeta(null);
      setNeedsLocation(false);
      return;
    }
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxMiles, tab, filter, useDeviceLocation, deviceLat, deviceLng, locationReady, savedHasCoords]);

  async function handleRequest(hit: Hit) {
    setClaimingId(hit.id);
    setMessage(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userBookId: hit.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Request failed" });
        return;
      }
      setMessage({ type: "ok", text: reserveSuccessMessage() });
      setResults((prev) => prev.filter((r) => r.id !== hit.id));
    } catch {
      setMessage({ type: "err", text: "Request failed" });
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div className="cozy-card overflow-hidden">
      <div className="cozy-panel border-b border-stone-100 px-4 sm:px-5">
        <div className="flex gap-1" role="tablist" aria-label="Find a book">
          {(
            [
              ["search", "Search"],
              ["looking", "Looking for"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => selectTab(id)}
              className={[
                "border-b-2 px-3 py-3.5 text-sm font-medium transition-colors",
                tab === id
                  ? "border-emerald-600 text-emerald-800"
                  : "border-transparent text-stone-600 hover:text-stone-900",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {tab === "search" && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch();
              }}
              className="flex gap-2"
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title or author"
                className="flex-1 rounded-xl border border-stone-300/90 bg-white px-3 py-2.5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="btn-primary !rounded-xl !px-4 disabled:opacity-50"
              >
                {loading ? "…" : "Search"}
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => selectFilter(id)}
                  className={[
                    "rounded-full px-3 py-1 text-sm font-medium border",
                    filter === id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-stone-300 bg-white text-stone-600 hover:border-stone-400",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <SearchDistanceFilters
          maxMiles={maxMiles}
          onMaxMilesChange={setMaxMiles}
          browseDefault={isBrowseMode && tab === "search"}
          savedHasCoords={savedHasCoords}
          useDeviceLocation={useDeviceLocation}
          deviceLat={deviceLat}
          onUseDeviceLocation={requestDeviceLocation}
          onClearDeviceLocation={clearDeviceLocation}
          geoStatus={geoStatus}
        />

        {tab !== "looking" && message && (
          <p
            className={`rounded-xl p-3 text-sm ${message.type === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}
          >
            {message.text}
          </p>
        )}

        {tab === "looking" ? (
          <WishlistTab
            maxMiles={maxMiles}
            useDeviceLocation={useDeviceLocation}
            deviceLat={deviceLat}
            deviceLng={deviceLng}
          />
        ) : (
          <>
            {!locationReady && <p className="text-sm text-stone-500">Loading…</p>}
            {locationReady && loading && <p className="text-sm text-stone-500">Loading…</p>}

            {locationReady && !loading && needsLocation && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p>Add a location to browse nearby books.</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <a href="/dashboard/location" className="font-medium text-emerald-800 hover:underline">
                    Set library location
                  </a>
                  <button
                    type="button"
                    onClick={requestDeviceLocation}
                    className="font-medium text-emerald-800 hover:underline"
                  >
                    Use current location
                  </button>
                </div>
              </div>
            )}

            {!loading && !needsLocation && searchMeta?.maxMiles != null && results.length > 0 && (
              <p className="text-xs text-stone-500">Within {searchMeta.maxMiles} mi</p>
            )}

            {!loading && !needsLocation && results.length === 0 && !message && locationReady && (
              <p className="text-sm text-stone-500">Nothing in range — widen distance or change filters.</p>
            )}

            {results.length > 0 && (
              <ul className="space-y-2">
                {results.map((hit) => (
                  <SearchResultCard key={hit.id} hit={hit} claimingId={claimingId} onReserve={handleRequest} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchResultCard({
  hit,
  claimingId,
  onReserve,
}: {
  hit: Hit;
  claimingId: string | null;
  onReserve: (hit: Hit) => void;
}) {
  const kind = hit.availabilityKind ?? listingAvailabilityKind(hit.locationType);
  const badgeStyles = {
    shelf: "bg-sky-100 text-sky-800",
    lend: "bg-violet-100 text-violet-800",
  };

  return (
    <li className="cozy-panel flex gap-3 p-3">
      {hit.book.coverUrl ? (
        <img src={hit.book.coverUrl} alt={hit.book.title} className="w-14 h-20 object-cover rounded shrink-0" />
      ) : (
        <div className="w-14 h-20 rounded bg-stone-100 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-stone-900">{hit.book.title}</p>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeStyles[kind]}`}>
            {availabilityBadgeLabel(kind)}
          </span>
        </div>
        {hit.book.author && <p className="text-sm text-stone-600">{hit.book.author}</p>}
        <p className="text-xs text-stone-500 mt-1">
          {hit.isOwnListing ? "Your listing" : hit.owner.name || "A member"}
          {hit.distanceMiles != null && <> · {formatMi(hit.distanceMiles)} mi</>}
          {!hit.isOwnListing && hit.ownerExchangeCount != null && hit.ownerExchangeCount > 0 && (
            <> · {hit.ownerExchangeCount} exchanges</>
          )}
        </p>
        {!hit.isOwnListing && (
          <button
            type="button"
            disabled={claimingId === hit.id}
            onClick={() => onReserve(hit)}
            className="mt-2 text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            {claimingId === hit.id ? "Sending…" : ASK_TO_PLACE_LABEL}
          </button>
        )}
      </div>
    </li>
  );
}

function formatMi(m: number) {
  return m < 10 ? m.toFixed(1) : String(Math.round(m));
}
