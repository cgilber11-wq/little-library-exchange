import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/claims/route";
import { PATCH as patchClaim } from "@/app/api/claims/[id]/route";
import { prisma } from "@/lib/prisma";
import { setAuthUser } from "../helpers/auth";
import { createListedBook, createUser } from "../helpers/factories";
import { getRequest, jsonRequest, readJson } from "../helpers/http";

describe("Claims API", () => {
  it("GET returns received and made claims for the user", async () => {
    const owner = await createUser("claim-owner@example.com");
    const claimer = await createUser("claimer@example.com");
    const { userBook } = await createListedBook(owner.id, { title: "Claimable" });

    setAuthUser(claimer);
    await POST(jsonRequest({ userBookId: userBook.id }));

    setAuthUser(owner);
    const res = await GET();
    const { status, data } = await readJson<{ received: Array<{ id: string }>; made: unknown[] }>(res);

    expect(status).toBe(200);
    expect(data.received).toHaveLength(1);
    expect(data.made).toHaveLength(0);
  });

  it("POST creates a claim and marks the book as claimed", async () => {
    const owner = await createUser("owner-claim@example.com");
    const claimer = await createUser("claimer-claim@example.com");
    const { userBook } = await createListedBook(owner.id);

    setAuthUser(claimer);
    const res = await POST(jsonRequest({ userBookId: userBook.id }));
    const { status, data } = await readJson<{ status: string; claimerId: string }>(res);

    expect(status).toBe(200);
    expect(data.status).toBe("pending");
    expect(data.claimerId).toBe(claimer.id);

    const updatedBook = await prisma.userBook.findUnique({ where: { id: userBook.id } });
    expect(updatedBook?.status).toBe("claimed");
  });

  it("POST rejects claiming your own book", async () => {
    const owner = await createUser("self-claim@example.com");
    const { userBook } = await createListedBook(owner.id);
    setAuthUser(owner);

    const res = await POST(jsonRequest({ userBookId: userBook.id }));
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/own book/i);
  });

  it("completes the full claim handoff and increments exchange count", async () => {
    const owner = await createUser("handoff-owner@example.com");
    const claimer = await createUser("handoff-claimer@example.com");
    const { userBook } = await createListedBook(owner.id, { title: "Handoff Book" });

    setAuthUser(claimer);
    const claimRes = await POST(jsonRequest({ userBookId: userBook.id }));
    const { data: claim } = await readJson<{ id: string }>(claimRes);

    setAuthUser(owner);
    const placedRes = await patchClaim(
      jsonRequest({ action: "book_placed" }),
      { params: Promise.resolve({ id: claim.id }) },
    );
    expect(placedRes.status).toBe(200);

    setAuthUser(claimer);
    const pickedRes = await patchClaim(
      jsonRequest({ action: "picked_up" }),
      { params: Promise.resolve({ id: claim.id }) },
    );
    const { status, data } = await readJson<{ status: string; returnBy: string }>(pickedRes);

    expect(status).toBe(200);
    expect(data.status).toBe("completed");
    expect(data.returnBy).toBeTruthy();

    const [ownerAfter, claimerAfter, listing, shareEvents] = await Promise.all([
      prisma.user.findUnique({ where: { id: owner.id } }),
      prisma.user.findUnique({ where: { id: claimer.id } }),
      prisma.userBook.findUnique({ where: { id: userBook.id } }),
      prisma.bookShareEvent.findMany({ where: { claimId: claim.id } }),
    ]);

    expect(ownerAfter?.score).toBe(1);
    expect(claimerAfter?.score).toBe(1);
    expect(listing?.status).toBe("gone");
    expect(shareEvents).toHaveLength(1);
  });

  it("PATCH picked_up requires owner to mark book placed first", async () => {
    const owner = await createUser("order-owner@example.com");
    const claimer = await createUser("order-claimer@example.com");
    const { userBook } = await createListedBook(owner.id);

    setAuthUser(claimer);
    const claimRes = await POST(jsonRequest({ userBookId: userBook.id }));
    const { data: claim } = await readJson<{ id: string }>(claimRes);

    const res = await patchClaim(
      jsonRequest({ action: "picked_up" }),
      { params: Promise.resolve({ id: claim.id }) },
    );
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/placed first/i);
  });
});
