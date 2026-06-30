/**
 * proxy.ts — Auth guard + security headers (Next.js 16+)
 *
 * Renamed from middleware.ts to proxy.ts per Next.js 16 convention.
 * https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Runs at the Next.js edge BEFORE any page component renders.
 * Unauthenticated requests to protected routes are redirected to /login
 * with the original destination preserved as ?redirect= for post-login
 * deep-link restoration.
 *
 * IMPORTANT: /api/* routes are EXCLUDED from this proxy entirely.
 * The backend (Render) handles its own authentication. Intercepting
 * /api/* here would block the rewrite proxy and cause HTTP 405 errors.
 *
 * Public paths (no auth required):
 *   /login, /reset-password
 *
 * Excluded entirely (Next.js internals + static files + API):
 *   /_next/*, /api/*, /models/*, favicon, images, fonts
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

const IS_PROD = process.env.NODE_ENV === 'production';

const PUBLIC_PATHS: string[] = [
  '/login',
  '/reset-password',
];

function isPublicPath(pathname: string): boolean {
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/models/') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png' ||
    pathname === '/619-logo.png' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return true;
  }

  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

function buildCsp(nonce: string, pathname: string): string {
  const isCheckin = pathname.startsWith('/checkin') || pathname.startsWith('/clients/');

  const scriptSrc = [
    `'nonce-${nonce}'`,
    "'self'",
    ...(IS_PROD ? [] : ["'unsafe-eval'"]),
    ...(isCheckin ? ["'unsafe-inline'"] : []),
  ];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': [`'nonce-${nonce}'`, "'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.fontshare.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://api.fontshare.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': ["'self'", 'https:', 'wss:'],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ['blob:'],
    'frame-ancestors': ["'none'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

function applySecurityHeaders(res: NextResponse, nonce: string, pathname: string): void {
  res.headers.set('x-nonce', nonce);
  res.headers.set('Content-Security-Policy', buildCsp(nonce, pathname));
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = crypto.randomBytes(16).toString('base64url');

  if (isPublicPath(pathname)) {
    const res = NextResponse.next();
    applySecurityHeaders(res, nonce, pathname);
    return res;
  }

  const token = req.cookies.get('token')?.value;

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Basic JWT format validation: 3 base64 segments separated by dots
  const segments = token.split('.');
  if (segments.length !== 3 || !segments.every(s => s.length > 0)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  applySecurityHeaders(res, nonce, pathname);
  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|models|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|woff2|woff|ttf|otf)).*)',
  ],
};
