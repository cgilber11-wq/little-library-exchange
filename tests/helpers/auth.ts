import type { Session } from "next-auth";

let mockSession: Session | null = null;

export function setAuthUser(user: { id: string; email: string; name?: string | null }) {
  mockSession = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

export function clearAuth() {
  mockSession = null;
}

export function getMockSession() {
  return mockSession;
}
