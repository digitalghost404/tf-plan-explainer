import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter
// Tracks request timestamps per IP over a 1-minute window.
// Note: state is per-process; for multi-instance deployments replace with
// a distributed store (e.g. Upstash Redis).
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    // Keep only recent entries to prevent unbounded growth
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// ---------------------------------------------------------------------------
// Allowed origins for API requests.
// In production, set ALLOWED_ORIGINS=https://yourdomain.com in your env.
// ---------------------------------------------------------------------------
function getAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (env) return env.split(',').map((o) => o.trim());
  // Default: allow localhost for development
  return ['http://localhost:3000', 'http://localhost:3001'];
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 1. Body size pre-check (defense-in-depth; route handler also validates)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  // 2. Origin validation — reject cross-origin requests that present a
  //    non-allowlisted Origin header.
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('host');
    const allowed = getAllowedOrigins();
    const sameHost =
      host && (origin === `https://${host}` || origin === `http://${host}`);

    if (!sameHost && !allowed.includes(origin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // 3. Rate limiting
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before trying again' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Window': '60s',
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
