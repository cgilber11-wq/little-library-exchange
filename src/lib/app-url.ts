/** Canonical site URL for QR codes and absolute links (set in production). */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function publicLibraryUrl(slug: string): string {
  return `${getAppBaseUrl()}/library/${slug}`;
}
