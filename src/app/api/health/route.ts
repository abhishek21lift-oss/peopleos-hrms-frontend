import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/health
 * Lightweight liveness probe — Docker HEALTHCHECK, load-balancer, uptime monitors.
 *
 * Rate limiting: in-memory sliding-window, 60 req / 60 s per IP.
 * Resets on deployment (acceptable for a health endpoint).
 *
 * WHY package.json is read this way:
 *   require('../../../package.json') resolves relative to the compiled output
 *   under .next/server, where the path depth differs from source. Using
 *   process.env.npm_package_version is the correct, path-agnostic approach.
 */

const WINDOW_MS   = 60_000;
const MAX_RPS     = 60;
const MAX_ENTRIES = 10_000;

type WindowEntry = { count: number; windowStart: number };
const ipWindows = new Map<string, WindowEntry>();

function isRateLimited(ip: string): { limited: boolean; retryAfter: number } {
  const now = Date.now();

  if (ipWindows.size > MAX_ENTRIES) {
    for (const [k, v] of ipWindows) {
      if (now - v.windowStart > WINDOW_MS) ipWindows.delete(k);
    }
  }

  const entry = ipWindows.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipWindows.set(ip, { count: 1, windowStart: now });
    return { limited: false, retryAfter: 0 };
  }

  if (entry.count >= MAX_RPS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { limited: true, retryAfter };
  }

  entry.count++;
  return { limited: false, retryAfter: 0 };
}

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0] : 'unknown').trim();

  const { limited, retryAfter } = isRateLimited(ip);
  if (limited) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(MAX_RPS),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  // Use the env var injected by npm at build/start time — no filesystem path needed.
  // Falls back to 'unknown' gracefully if running outside npm (e.g. direct node invocation).
  const version = process.env.npm_package_version ?? 'unknown';

  return NextResponse.json(
    {
      status: 'ok',
      service: 'peopleos-hrms-frontend',
      timestamp: new Date().toISOString(),
      version,
      env: process.env.NODE_ENV,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache',
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(MAX_RPS),
      },
    },
  );
}
