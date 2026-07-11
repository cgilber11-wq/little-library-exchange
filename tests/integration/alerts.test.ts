import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/alerts/route";
import { POST as createClaim } from "@/app/api/claims/route";
import { PATCH as patchClaim } from "@/app/api/claims/[id]/route";
import { setAuthUser } from "../helpers/auth";
import { createListedBook, createUser } from "../helpers/factories";
import { jsonRequest, readJson } from "../helpers/http";

describe("Alerts API", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("includes a pending request alert for the book owner", async () => {
    const owner = await createUser("alert-owner@example.com");
    const claimer = await createUser("alert-claimer@example.com");
    const { userBook } = await createListedBook(owner.id, { title: "Alert Book" });

    setAuthUser(claimer);
    await createClaim(jsonRequest({ userBookId: userBook.id }));

    setAuthUser(owner);
    const res = await GET();
    const { status, data } = await readJson<{ alerts: Array<{ kind: string; title: string; detail: string }> }>(res);

    expect(status).toBe(200);
    expect(data.alerts.some((a) => a.kind === "request" && a.detail.includes("Alert Book"))).toBe(true);
  });

  it("includes a ready-for-pickup alert for the claimer", async () => {
    const owner = await createUser("pickup-owner@example.com");
    const claimer = await createUser("pickup-claimer@example.com");
    const { userBook } = await createListedBook(owner.id, { title: "Pickup Alert Book" });

    setAuthUser(claimer);
    const claimRes = await createClaim(jsonRequest({ userBookId: userBook.id }));
    const { data: claim } = await readJson<{ id: string }>(claimRes);

    setAuthUser(owner);
    await patchClaim(jsonRequest({ action: "book_placed" }), { params: Promise.resolve({ id: claim.id }) });

    setAuthUser(claimer);
    const res = await GET();
    const { data } = await readJson<{ alerts: Array<{ kind: string; title: string }> }>(res);

    expect(data.alerts.some((a) => a.kind === "pickup" && a.title === "Ready for pickup")).toBe(true);
  });
});
