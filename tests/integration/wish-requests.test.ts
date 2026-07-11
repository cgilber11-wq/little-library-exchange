import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/book-wish-requests/route";
import { DELETE } from "@/app/api/book-wish-requests/[id]/route";
import { POST as respondToWish } from "@/app/api/book-wish-requests/[id]/respond/route";
import { prisma } from "@/lib/prisma";
import { setAuthUser } from "../helpers/auth";
import { createListedBook, createLocation, createUser } from "../helpers/factories";
import { getRequest, jsonRequest, readJson } from "../helpers/http";

describe("Book wish requests API", () => {
  it("POST creates an open wish request", async () => {
    const user = await createUser("wisher@example.com");
    setAuthUser(user);

    const res = await POST(jsonRequest({ title: "Project Hail Mary", author: "Andy Weir", note: "Hardcover ok" }));
    const { status, data } = await readJson<{ title: string; status: string; author: string }>(res);

    expect(status).toBe(200);
    expect(data.title).toBe("Project Hail Mary");
    expect(data.status).toBe("open");
    expect(data.author).toBe("Andy Weir");
  });

  it("POST enforces a maximum of five open requests", async () => {
    const user = await createUser("max-wishes@example.com");
    setAuthUser(user);

    for (let i = 0; i < 5; i++) {
      const res = await POST(jsonRequest({ title: `Wish ${i}` }));
      expect(res.status).toBe(200);
    }

    const res = await POST(jsonRequest({ title: "One too many" }));
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/at most 5/i);
  });

  it("GET returns community wishes excluding the current user", async () => {
    const requester = await createUser("requester@example.com");
    await createLocation(requester.id);
    const responder = await createUser("responder@example.com");
    await createLocation(responder.id);

    setAuthUser(requester);
    await POST(jsonRequest({ title: "Community Wish" }));

    setAuthUser(responder);
    const res = await GET(getRequest("http://localhost/api/book-wish-requests?lat=42.36&lng=-71.06&maxMiles=50"));
    const { status, data } = await readJson<{ results: Array<{ title: string }> }>(res);

    expect(status).toBe(200);
    expect(data.results.some((r) => r.title === "Community Wish")).toBe(true);
  });

  it("POST respond matches a wish and creates a listing", async () => {
    const requester = await createUser("wish-requester@example.com");
    const responder = await createUser("wish-responder@example.com");

    setAuthUser(requester);
    const wishRes = await POST(jsonRequest({ title: "Matched Title", author: "Matched Author" }));
    const { data: wish } = await readJson<{ id: string }>(wishRes);

    setAuthUser(responder);
    const res = await respondToWish(
      jsonRequest({ confirm: true }),
      { params: Promise.resolve({ id: wish.id }) },
    );
    const { status, data } = await readJson<{ ok: boolean; userBook: { book: { title: string } } }>(res);

    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.userBook.book.title).toBe("Matched Title");

    const updatedWish = await prisma.bookWishRequest.findUnique({ where: { id: wish.id } });
    expect(updatedWish?.status).toBe("matched");
    expect(updatedWish?.responderId).toBe(responder.id);
  });

  it("DELETE cancels an open wish request", async () => {
    const user = await createUser("cancel-wish@example.com");
    setAuthUser(user);

    const wishRes = await POST(jsonRequest({ title: "Cancel Me" }));
    const { data: wish } = await readJson<{ id: string }>(wishRes);

    const res = await DELETE(getRequest("http://localhost/api/book-wish-requests/x", "DELETE"), {
      params: Promise.resolve({ id: wish.id }),
    });
    expect(res.status).toBe(200);

    const updated = await prisma.bookWishRequest.findUnique({ where: { id: wish.id } });
    expect(updated?.status).toBe("cancelled");
  });

  it("respond rejects responding to your own wish", async () => {
    const user = await createUser("self-wish@example.com");
    setAuthUser(user);

    const wishRes = await POST(jsonRequest({ title: "My Own Wish" }));
    const { data: wish } = await readJson<{ id: string }>(wishRes);

    const res = await respondToWish(
      jsonRequest({ confirm: true }),
      { params: Promise.resolve({ id: wish.id }) },
    );
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/own request/i);
  });

  it("respond rejects duplicate active listing for same title", async () => {
    const requester = await createUser("dup-wish-requester@example.com");
    const responder = await createUser("dup-wish-responder@example.com");
    await createListedBook(responder.id, { title: "Already Listed", author: "Same Author" });

    setAuthUser(requester);
    const wishRes = await POST(jsonRequest({ title: "Already Listed", author: "Same Author" }));
    const { data: wish } = await readJson<{ id: string }>(wishRes);

    setAuthUser(responder);
    const res = await respondToWish(
      jsonRequest({ confirm: true }),
      { params: Promise.resolve({ id: wish.id }) },
    );
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/already have an active listing/i);
  });
});
