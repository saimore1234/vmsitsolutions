/** Fetch client shared by server & client components. */

export const API_URL =
  typeof window === "undefined"
    ? process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export async function publicGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return fallback;
    const json = await res.json();
    return (json.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

// ── Browser-side authenticated client (admin portal) ──

let accessToken: string | null = null;
export function setAccessToken(t: string | null) {
  accessToken = t;
  if (typeof window !== "undefined") {
    if (t) sessionStorage.setItem("vms_at", t);
    else sessionStorage.removeItem("vms_at");
  }
}
export function getAccessToken() {
  if (!accessToken && typeof window !== "undefined") accessToken = sessionStorage.getItem("vms_at");
  return accessToken;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) return false;
    const json = await res.json();
    setAccessToken(json.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { retry?: boolean } = {},
): Promise<T> {
  const { retry = true, ...init } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && retry && (await tryRefresh())) {
    return api<T>(path, { ...init, retry: false });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json.data as T;
}
