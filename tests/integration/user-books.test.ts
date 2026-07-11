import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/user-books/route";
import { PATCH } from "@/app/api/user-books/[id]/route";
import { prisma } from "@/lib/prisma";
import { setAuthUser } from "../helpers/auth";
import { createListedBook, createUser } from "../helpers/factories";
import { getRequest, jsonRequest, readJson } from "../helpers/http";

describe("User books API", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("POST adds a new book to the little library", async () => {
    const user = await createUser("owner@example.com");
    setAuthUser(user);

    const res = await POST(
      jsonRequest({
        title: "Dune",
        author: "Frank Herbert",
        locationType: "my_library",
      }),
    );
    const { status, data } = await readJson<{ locationType: string; book: { title: string } }>(res);

    expect(status).toBe(200);
    expect(data.locationType).toBe("my_library");
    expect(data.book.title).toBe("Dune");

    const copy = await prisma.bookCopy.findFirst({ where: { originalOwnerId: user.id } });
    expect(copy).toBeTruthy();
  });

  it("POST adds a book to collection without placing on shelf", async () => {
    const user = await createUser("collector@example.com");
    setAuthUser(user);

    const res = await POST(
      jsonRequest({
        title: "Collected Title",
        locationType: "collection",
      }),
    );
    const { status, data } = await readJson<{ locationType: string; libraryPlacedAt: string | null }>(res);

    expect(status).toBe(200);
    expect(data.locationType).toBe("collection");
    expect(data.libraryPlacedAt).toBeNull();
  });

  it("GET lists the authenticated user's books", async () => {
    const user = await createUser("lister@example.com");
    await createListedBook(user.id, { title: "Listed One" });
    setAuthUser(user);

    const res = await GET();
    const { status, data } = await readJson<Array<{ book: { title: string } }>>(res);

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].book.title).toBe("Listed One");
  });

  it("PATCH moves a book between collection and little library", async () => {
    const user = await createUser("mover@example.com");
    const { userBook } = await createListedBook(user.id, { locationType: "collection" });
    setAuthUser(user);

    const addRes = await PATCH(
      jsonRequest({ action: "add_to_little_library" }),
      { params: Promise.resolve({ id: userBook.id }) },
    );
    const { data: added } = await readJson<{ locationType: string }>(addRes);
    expect(added.locationType).toBe("my_library");

    const removeRes = await PATCH(
      jsonRequest({ action: "remove_from_little_library" }),
      { params: Promise.resolve({ id: userBook.id }) },
    );
    const { data: removed } = await readJson<{ locationType: string }>(removeRes);
    expect(removed.locationType).toBe("collection");
  });

  it("PATCH remove_from_collection marks book as removed", async () => {
    const user = await createUser("remover@example.com");
    const { userBook } = await createListedBook(user.id);
    setAuthUser(user);

    const res = await PATCH(
      jsonRequest({ action: "remove_from_collection" }),
      { params: Promise.resolve({ id: userBook.id }) },
    );
    const { status, data } = await readJson<{ status: string; removedAt: string | null }>(res);

    expect(status).toBe(200);
    expect(data.status).toBe("removed");
    expect(data.removedAt).toBeTruthy();
  });

  it("PATCH rejects actions on another user's listing", async () => {
    const owner = await createUser("owner2@example.com");
    const stranger = await createUser("stranger@example.com");
    const { userBook } = await createListedBook(owner.id);
    setAuthUser(stranger);

    const res = await PATCH(
      jsonRequest({ action: "remove_from_collection" }),
      { params: Promise.resolve({ id: userBook.id }) },
    );
    expect(res.status).toBe(404);
  });
});
