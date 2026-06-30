// src/lib/http.ts
//
// Hardened fetch wrapper. apiBase() is LAZY — evaluated at call time,
// not at module init — to prevent SSR crashes when the env var is absent.
//
// Adds:
//   - Typed ApiError with status + code
//   - In-flight request deduplication (no double-fetch on rapid mounts)
//   - In-memory cache with per-call TTL (idempotent GETs only)
//   - AbortSignal support so unmounting cancels the request
//   - Tiny exponential backoff retry for network blips on GET
//   - Global 401 handler: fires a 'session-expired' CustomEvent instead of
//     hard-navigating via window.location.href. AuthProvider listens to this
//     event, clears state, and uses the Next.js router for a soft redirect.

function apiBase(): string {
  // In production (Vercel), use same-origin proxy via next.config.js rewrites.
  // This avoids cross-origin cookie issues with the httpOnly JWT cookie.
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return '';
  }
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!raw) {
    throw new Error(
      '[619-erp] NEXT_PUBLIC_API_URL is not set. ' +
      'Copy .env.example to .env.local and set NEXT_PUBLIC_API_URL=http://localhost:5000'
    );
  }
  return raw;
}

// ──────────────────────────────────────────────────────────────────────
//  ApiError
// ──────────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(message: string, status: number, code?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }

  get isAuth()      { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound()  { return this.status === 404; }
  get isServer()    { return this.status >= 500; }
}

// ──────────────────────────────────────────────────────────────────────
//  In-flight deduplication + in-memory cache
// ──────────────────────────────────────────────────────────────────────
const inflight = new Map<string, Promise<unknown>>();
interface CacheEntry { data: unknown; expiresAt: number; }
const cache    = new Map<string, CacheEntry>();

// ──────────────────────────────────────────────────────────────────────
//  Options
// ──────────────────────────────────────────────────────────────────────
export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?:        unknown;
  ttl?:         number;
  cacheMs?:     number;
  retries?:     number;
  signal?:      AbortSignal;
  skipAuth?:    boolean;
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return body;
  if (
    isFormDataBody(body) ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }
  return JSON.stringify(body);
}

// ──────────────────────────────────────────────────────────────────────
//  Global 401 handler
// ──────────────────────────────────────────────────────────────────────
const SESSION_USER_KEY = '619_user_minimal_v3';
let _redirecting = false;

/** Reset the redirect lock — called by AuthProvider after login() succeeds. */
export function resetRedirectLock(): void {
  _redirecting = false;
}

function handleUnauthorized(): void {
  if (typeof window === 'undefined' || _redirecting) return;
  if (window.location.pathname === '/login') return;
  _redirecting = true;
  try { sessionStorage.removeItem(SESSION_USER_KEY); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent('session-expired'));
}

// ──────────────────────────────────────────────────────────────────────
//  Core
// ──────────────────────────────────────────────────────────────────────
async function fetchOnce<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    let code: string | undefined;
    let payload: unknown;
    try {
      payload = await res.json();
      if (payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        const errField = p.error;
        if (errField && typeof errField === 'object') {
          const nested = errField as Record<string, unknown>;
          msg  = (nested.message ?? msg) as string;
          code = nested.code as string | undefined;
        } else {
          msg  = (p.message ?? p.error ?? msg) as string;
          code = p.code as string | undefined;
        }
      }
    } catch { /* ignore parse error */ }

    if (res.status === 401) {
      handleUnauthorized();
    }

    throw new ApiError(msg, res.status, code, payload);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function http<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const BASE = apiBase();
  const url  = path.startsWith('http') ? path : `${BASE}${path}`;
  const method = (options.method ?? 'GET').toUpperCase();

  const ttl = options.ttl ?? options.cacheMs;

  const body = serializeBody(options.body);
  const isMultipart = isFormDataBody(options.body);
  const headers: Record<string, string> = {
    ...(!isMultipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const cacheKey = method === 'GET' ? url : '';

  if (cacheKey && ttl) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.data as T;
  }

  const init: RequestInit = {
    ...options,
    method,
    headers,
    credentials: 'include',
    signal: options.signal,
    body,
  };

  if (method === 'GET' && cacheKey) {
    const existing = inflight.get(cacheKey);
    if (existing) return existing as Promise<T>;
  }

  const maxRetries = method === 'GET' ? (options.retries ?? 2) : 0;
  let attempt = 0;

  const doFetch = async (): Promise<T> => {
    try {
      const result = await fetchOnce<T>(url, init);
      if (cacheKey && ttl) {
        cache.set(cacheKey, { data: result, expiresAt: Date.now() + ttl });
      }
      return result;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (attempt < maxRetries) {
        attempt++;
        await new Promise(r => setTimeout(r, 300 * 2 ** (attempt - 1)));
        return doFetch();
      }
      throw err;
    } finally {
      if (cacheKey) inflight.delete(cacheKey);
    }
  };

  const promise = doFetch();
  if (method === 'GET' && cacheKey) inflight.set(cacheKey, promise as Promise<unknown>);
  return promise;
}

export const request = http;
export default http;
