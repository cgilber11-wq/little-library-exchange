import { beforeEach, vi } from "vitest";
import { resetDatabase } from "./helpers/db";
import { clearAuth } from "./helpers/auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => {
    const { getMockSession } = await import("./helpers/auth");
    return getMockSession();
  }),
}));

beforeEach(async () => {
  clearAuth();
  await resetDatabase();
});
