import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { jsonRequest, readJson } from "../helpers/http";

describe("POST /api/auth/register", () => {
  it("creates a new user", async () => {
    const res = await register(
      jsonRequest({ email: "alice@example.com", password: "secret123", name: "Alice" }),
    );
    const { status, data } = await readJson<{ id: string; email: string }>(res);

    expect(status).toBe(200);
    expect(data.email).toBe("alice@example.com");

    const stored = await prisma.user.findUnique({ where: { email: "alice@example.com" } });
    expect(stored?.name).toBe("Alice");
    expect(stored?.passwordHash).toBeTruthy();
  });

  it("rejects duplicate email", async () => {
    await register(jsonRequest({ email: "dup@example.com", password: "secret123" }));
    const res = await register(jsonRequest({ email: "dup@example.com", password: "other456" }));
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/already registered/i);
  });

  it("requires email and password", async () => {
    const res = await register(jsonRequest({ email: "missing@example.com" }));
    const { status, data } = await readJson<{ error: string }>(res);

    expect(status).toBe(400);
    expect(data.error).toMatch(/required/i);
  });
});
