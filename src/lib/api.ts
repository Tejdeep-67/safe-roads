// fetch wrapper for our own Netlify Functions: JSON in/out, a timeout, and error
// messages a person can read
export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const OFFLINE_MESSAGE = "Can't reach the Safe Roads server. Check your connection and try again.";

export async function api<T>(path: string, init: RequestInit & { json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { json, timeoutMs = 12000, ...rest } = init;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers || {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      signal: rest.signal ?? ctl.signal,
    });
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  } finally {
    clearTimeout(timer);
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  // on a static host without functions /api/* falls through to index.html
  if (!isJson) throw new ApiError(OFFLINE_MESSAGE, res.ok ? 0 : res.status);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && typeof data.error === 'string' && data.error) || `Something went wrong (${res.status}).`;
    throw new ApiError(res.status === 429 ? msg : msg, res.status, data);
  }
  return data as T;
}
