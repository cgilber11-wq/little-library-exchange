import { describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/user/settings/route";
import { setAuthUser } from "../helpers/auth";
import { createUser } from "../helpers/factories";
import { jsonRequest, readJson } from "../helpers/http";

describe("User settings API", () => {
  it("GET returns default pickup and return windows", async () => {
    const user = await createUser("settings@example.com");
    setAuthUser(user);

    const res = await GET();
    const { status, data } = await readJson<{ bookCheckoutDays: number; bookReturnDays: number }>(res);

    expect(status).toBe(200);
    expect(data.bookCheckoutDays).toBe(14);
    expect(data.bookReturnDays).toBe(30);
  });

  it("PUT updates checkout and return days", async () => {
    const user = await createUser("settings-update@example.com");
    setAuthUser(user);

    const res = await PUT(jsonRequest({ bookCheckoutDays: 21, bookReturnDays: 45 }));
    const { status, data } = await readJson<{ bookCheckoutDays: number; bookReturnDays: number }>(res);

    expect(status).toBe(200);
    expect(data.bookCheckoutDays).toBe(21);
    expect(data.bookReturnDays).toBe(45);
  });

  it("PUT rejects invalid day values", async () => {
    const user = await createUser("settings-invalid@example.com");
    setAuthUser(user);

    const res = await PUT(jsonRequest({ bookCheckoutDays: 0 }));
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/between 1 and 365/i);
  });

  it("PUT requires at least one field", async () => {
    const user = await createUser("settings-empty@example.com");
    setAuthUser(user);

    const res = await PUT(jsonRequest({}));
    expect(res.status).toBe(400);
  });
});
