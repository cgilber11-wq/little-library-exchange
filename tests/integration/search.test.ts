import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/search/route";
import { setAuthUser } from "../helpers/auth";
import { createListedBook, createLocation, createUser } from "../helpers/factories";
import { getRequest, readJson } from "../helpers/http";
import { prisma } from "@/lib/prisma";

describe("Search API", () => {
  it("finds books by title query", async () => {
    const owner = await createUser("search-owner@example.com");
    await createLocation(owner.id);
    await createListedBook(owner.id, { title: "Unique Search Title", author: "Search Author" });

    const searcher = await createUser("searcher@example.com");
    await createLocation(searcher.id, { lat: 42.36, lng: -71.06 });
    setAuthUser(searcher);

    const res = await GET(
      getRequest("http://localhost/api/search?q=Unique+Search&lat=42.36&lng=-71.06"),
    );
    const { status, data } = await readJson<{ results: Array<{ book: { title: string } }> }>(res);

    expect(status).toBe(200);
    expect(data.results.some((r) => r.book.title === "Unique Search Title")).toBe(true);
  });

  it("includes collection books in title search when shared", async () => {
    const owner = await createUser("collection-owner@example.com");
    await createLocation(owner.id);
    await createListedBook(owner.id, {
      title: "Collection Only Book",
      locationType: "collection",
    });

    const searcher = await createUser("collection-searcher@example.com");
    await createLocation(searcher.id, { lat: 42.36, lng: -71.06 });
    setAuthUser(searcher);

    const res = await GET(
      getRequest("http://localhost/api/search?q=Collection+Only&lat=42.36&lng=-71.06"),
    );
    const { data } = await readJson<{
      results: Array<{ book: { title: string }; locationType: string; availabilityKind: string }>;
    }>(res);

    expect(data.results.some((r) => r.book.title === "Collection Only Book")).toBe(true);
    expect(data.results.find((r) => r.book.title === "Collection Only Book")?.availabilityKind).toBe("lend");
  });

  it("excludes collection books when owner disabled sharing", async () => {
    const owner = await createUser("collection-private@example.com");
    await createLocation(owner.id);
    await prisma.location.update({
      where: { userId: owner.id },
      data: { shareCollectionOnPublicPage: false },
    });
    await createListedBook(owner.id, {
      title: "Private Collection Book",
      locationType: "collection",
    });

    const searcher = await createUser("collection-private-searcher@example.com");
    await createLocation(searcher.id, { lat: 42.36, lng: -71.06 });
    setAuthUser(searcher);

    const res = await GET(
      getRequest("http://localhost/api/search?q=Private+Collection&lat=42.36&lng=-71.06"),
    );
    const { data } = await readJson<{ results: Array<{ book: { title: string } }> }>(res);

    expect(data.results.some((r) => r.book.title === "Private Collection Book")).toBe(false);
  });

  it("excludes the searcher's own listings by default", async () => {
    const user = await createUser("self-search@example.com");
    await createLocation(user.id, { lat: 42.36, lng: -71.06 });
    await createListedBook(user.id, { title: "My Own Listing" });
    setAuthUser(user);

    const res = await GET(
      getRequest("http://localhost/api/search?q=My+Own&lat=42.36&lng=-71.06"),
    );
    const { data } = await readJson<{ results: Array<{ isOwnListing: boolean }> }>(res);

    expect(data.results).toHaveLength(0);
  });

  it("includes own listings when includeMine=1", async () => {
    const user = await createUser("include-mine@example.com");
    await createLocation(user.id, { lat: 42.36, lng: -71.06 });
    await createListedBook(user.id, { title: "Include Mine Book" });
    setAuthUser(user);

    const res = await GET(
      getRequest("http://localhost/api/search?q=Include+Mine&lat=42.36&lng=-71.06&includeMine=1"),
    );
    const { data } = await readJson<{ results: Array<{ isOwnListing: boolean; book: { title: string } }> }>(res);

    expect(data.results).toHaveLength(1);
    expect(data.results[0].isOwnListing).toBe(true);
    expect(data.results[0].book.title).toBe("Include Mine Book");
  });

  it("returns on-shelf listings in shelf browse mode", async () => {
    const owner = await createUser("nearby-owner@example.com");
    await createLocation(owner.id, { lat: 42.361, lng: -71.059 });
    await createListedBook(owner.id, { title: "Nearby Shelf Book", author: "Near Author" });
    await createListedBook(owner.id, { title: "Home Only Book", locationType: "collection" });

    const viewer = await createUser("nearby-viewer@example.com");
    await createLocation(viewer.id, { lat: 42.36, lng: -71.06 });
    setAuthUser(viewer);

    const res = await GET(getRequest("http://localhost/api/search?mode=shelf"));
    const { status, data } = await readJson<{
      results: Array<{ book: { title: string }; distanceMiles: number | null }>;
    }>(res);

    expect(status).toBe(200);
    expect(data.results.some((r) => r.book.title === "Nearby Shelf Book")).toBe(true);
    expect(data.results.some((r) => r.book.title === "Home Only Book")).toBe(false);
    expect(data.results[0]?.distanceMiles).not.toBeNull();
  });

  it("returns collection listings in lend browse mode", async () => {
    const owner = await createUser("lend-owner@example.com");
    await createLocation(owner.id, { lat: 42.361, lng: -71.059 });
    await createListedBook(owner.id, { title: "Shelf Book Only", locationType: "my_library" });
    await createListedBook(owner.id, { title: "Lend From Home Book", locationType: "collection" });

    const viewer = await createUser("lend-viewer@example.com");
    await createLocation(viewer.id, { lat: 42.36, lng: -71.06 });
    setAuthUser(viewer);

    const res = await GET(getRequest("http://localhost/api/search?mode=lend"));
    const { status, data } = await readJson<{
      results: Array<{ book: { title: string }; availabilityKind: string }>;
    }>(res);

    expect(status).toBe(200);
    expect(data.results.some((r) => r.book.title === "Lend From Home Book")).toBe(true);
    expect(data.results.some((r) => r.book.title === "Shelf Book Only")).toBe(false);
    expect(data.results.find((r) => r.book.title === "Lend From Home Book")?.availabilityKind).toBe("lend");
  });

  it("returns shelf and collection listings in all browse mode", async () => {
    const owner = await createUser("all-browse-owner@example.com");
    await createLocation(owner.id, { lat: 42.361, lng: -71.059 });
    await createListedBook(owner.id, { title: "Shelf In All Browse", locationType: "my_library" });
    await createListedBook(owner.id, { title: "Collection In All Browse", locationType: "collection" });

    const viewer = await createUser("all-browse-viewer@example.com");
    await createLocation(viewer.id, { lat: 42.36, lng: -71.06 });
    setAuthUser(viewer);

    const res = await GET(getRequest("http://localhost/api/search?mode=all"));
    const { status, data } = await readJson<{ results: Array<{ book: { title: string } }> }>(res);

    expect(status).toBe(200);
    expect(data.results.some((r) => r.book.title === "Shelf In All Browse")).toBe(true);
    expect(data.results.some((r) => r.book.title === "Collection In All Browse")).toBe(true);
  });

  it("returns empty results when search query is missing", async () => {
    const user = await createUser("empty-search@example.com");
    setAuthUser(user);

    const res = await GET(getRequest("http://localhost/api/search"));
    const { status, data } = await readJson<{ results: unknown[] }>(res);

    expect(status).toBe(200);
    expect(data.results).toEqual([]);
  });
});
