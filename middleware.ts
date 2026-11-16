import { NextResponse, type NextRequest } from 'next/server';

// A removed (taken down) account must answer 410 Gone, which a page component cannot set.
// The middleware asks the API for the account status and rewrites to /gone with status 410.
// Results are cached in memory for a short time to keep API traffic low.
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TTL_MS = 60_000;
const cache = new Map<string, { gone: boolean; at: number }>();

async function isGone(handle: string): Promise<boolean> {
  const hit = cache.get(handle);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.gone;
  try {
    const res = await fetch(`${API_URL}/api/v1/ratings/${encodeURIComponent(handle)}/history`, { cache: 'no-store' });
    const gone = res.status === 410;
    if (cache.size > 500) cache.clear();
    cache.set(handle, { gone, at: Date.now() });
    return gone;
  } catch {
    return false; // API unreachable: let the page render its own error state
  }
}

export async function middleware(req: NextRequest) {
  const handle = req.nextUrl.pathname.split('/')[2];
  if (handle && (await isGone(handle))) {
    return NextResponse.rewrite(new URL('/gone', req.url), { status: 410 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/ratings/:handle', '/ratings/:handle/history'] };
