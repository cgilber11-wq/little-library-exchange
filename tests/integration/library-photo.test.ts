import { describe, expect, it } from "vitest";
import { POST, DELETE } from "@/app/api/library-page/photo/route";
import { GET } from "@/app/api/public/library/[slug]/route";
import { prisma } from "@/lib/prisma";
import { setAuthUser } from "../helpers/auth";
import { createLocation, createUser } from "../helpers/factories";
import { getRequest, readJson } from "../helpers/http";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z4BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function photoRequest(userId: string) {
  const form = new FormData();
  form.append("photo", new Blob([TINY_PNG], { type: "image/png" }), "library.png");
  return new Request("http://localhost/api/library-page/photo", { method: "POST", body: form });
}

describe("Library profile photo API", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(photoRequest("x"));
    expect(res.status).toBe(401);
  });

  it("uploads a photo and exposes it on the public library profile", async () => {
    const user = await createUser("photo-lib@example.com", "password123", "Sam");
    await createLocation(user.id, { label: "Photo Test Library" });
    await prisma.location.update({
      where: { userId: user.id },
      data: { publicSlug: "photo-test-lib" },
    });
    setAuthUser(user);

    const uploadRes = await POST(photoRequest(user.id));
    const { status, data } = await readJson<{ photoUrl: string }>(uploadRes);
    expect(status).toBe(200);
    expect(data.photoUrl).toMatch(/^\/uploads\/libraries\/.+\.png$/);

    const publicRes = await GET(getRequest("http://localhost/api/public/library/photo-test-lib"), {
      params: { slug: "photo-test-lib" },
    });
    const { data: publicData } = await readJson<{ library: { photoUrl: string } }>(publicRes);
    expect(publicData.library.photoUrl).toBe(data.photoUrl);
  });

  it("DELETE removes the photo", async () => {
    const user = await createUser("photo-del@example.com");
    await createLocation(user.id);
    await prisma.location.update({
      where: { userId: user.id },
      data: { publicSlug: "photo-del-lib", photoUrl: "/uploads/libraries/old.png" },
    });
    setAuthUser(user);

    const res = await DELETE();
    const { status, data } = await readJson<{ photoUrl: string | null }>(res);
    expect(status).toBe(200);
    expect(data.photoUrl).toBeNull();
  });
});
