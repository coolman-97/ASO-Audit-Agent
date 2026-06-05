/** Tiny fetch helpers with timeouts so a slow upstream never hangs the audit. */

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      // A UA header keeps Apple's endpoints happy.
      headers: { "User-Agent": "ASO-Audit-Agent/1.0", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
