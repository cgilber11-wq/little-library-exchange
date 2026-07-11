import { describe, expect, it } from "vitest";
import { GET, PUT, PATCH } from "@/app/api/location/route";
import { prisma } from "@/lib/prisma";
import { setAuthUser } from "../helpers/auth";
import { createUser } from "../helpers/factories";
import { getRequest, jsonRequest, readJson } from "../helpers/http";

describe("Location API", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("PUT saves a library location", async () => {
    const user = await createUser("loc-user@example.com");
    setAuthUser(user);

    const res = await PUT(
      jsonRequest(
        {
          label: "Oak Street Library",
          lat: 42.36,
          lng: -71.06,
          address: "1 Oak St",
        },
        "PUT",
      ),
    );
    const { status, data } = await readJson<{ label: string; lat: number; lng: number }>(res);

    expect(status).toBe(200);
    expect(data.label).toBe("Oak Street Library");
    expect(data.lat).toBe(42.36);

    const stored = await prisma.location.findUnique({ where: { userId: user.id } });
    expect(stored?.address).toBe("1 Oak St");
  });

  it("PATCH verify_library records last verified timestamp", async () => {
    const user = await createUser("verify-user@example.com");
    setAuthUser(user);

    const res = await PATCH(jsonRequest({ action: "verify_library" }));
    const { status, data } = await readJson<{ libraryLastVerifiedAt: string }>(res);

    expect(status).toBe(200);
    expect(data.libraryLastVerifiedAt).toBeTruthy();

    const stored = await prisma.location.findUnique({ where: { userId: user.id } });
    expect(stored?.libraryLastVerifiedAt).toBeTruthy();
  });

  it("PATCH rejects unknown actions", async () => {
    const user = await createUser("bad-action@example.com");
    setAuthUser(user);

    const res = await PATCH(jsonRequest({ action: "unknown" }));
    expect(res.status).toBe(400);
  });
});
