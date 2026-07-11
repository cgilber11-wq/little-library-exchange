import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/public/library/[slug]/route";
import { prisma } from "@/lib/prisma";
import { createListedBook, createLocation, createUser } from "../helpers/factories";
import { getRequest, readJson } from "../helpers/http";

describe("Public library page API", () => {
  it("returns 404 for unknown slug", async () => {
    const res = await GET(getRequest("http://localhost/api/public/library/no-such-library"), {
      params: { slug: "no-such-library" },
    });
    expect(res.status).toBe(404);
  });

  it("lists shelf and collection books without auth", async () => {
    const owner = await createUser("public-lib@example.com", "password123", "Pat");
    await createLocation(owner.id, { label: "Oak Street Little Library", address: "1 Oak St" });
    await prisma.location.update({
      where: { userId: owner.id },
      data: { publicSlug: "oak-street-test" },
    });

    await createListedBook(owner.id, { title: "Shelf Book", locationType: "my_library" });
    await createListedBook(owner.id, { title: "Home Book", locationType: "collection" });

    const res = await GET(getRequest("http://localhost/api/public/library/oak-street-test"), {
      params: { slug: "oak-street-test" },
    });
    const { status, data } = await readJson<{
      library: { onShelf: { book: { title: string } }[]; fromCollection: { book: { title: string } }[] };
    }>(res);

    expect(status).toBe(200);
    expect(data.library.onShelf.map((b) => b.book.title)).toContain("Shelf Book");
    expect(data.library.fromCollection.map((b) => b.book.title)).toContain("Home Book");
  });

  it("hides collection when shareCollectionOnPublicPage is false", async () => {
    const owner = await createUser("private-coll@example.com");
    await prisma.location.create({
      data: {
        userId: owner.id,
        label: "Private Coll Lib",
        publicSlug: "private-coll",
        shareCollectionOnPublicPage: false,
      },
    });
    await createListedBook(owner.id, { title: "Hidden Home Book", locationType: "collection" });
    await createListedBook(owner.id, { title: "Visible Shelf", locationType: "my_library" });

    const res = await GET(getRequest("http://localhost/api/public/library/private-coll"), {
      params: { slug: "private-coll" },
    });
    const { data } = await readJson<{
      library: { onShelf: unknown[]; fromCollection: unknown[] };
    }>(res);

    expect(data.library.onShelf.length).toBe(1);
    expect(data.library.fromCollection.length).toBe(0);
  });
});
