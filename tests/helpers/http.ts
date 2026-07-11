export async function readJson<T = unknown>(res: Response): Promise<{ status: number; data: T }> {
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

export function jsonRequest(body: unknown, method = "POST", url = "http://localhost/api/test") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getRequest(url = "http://localhost/api/test", method = "GET") {
  return new Request(url, { method });
}
