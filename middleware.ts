import { NextRequest, NextResponse } from 'next/server';

const SESSION_MINUTES = 20;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: login page, auth API, Next.js internals, static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('jfint_auth')?.value;
  const expected = process.env.AUTH_PASSWORD;

  if (!token || token !== expected) {
    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Slide the session — refresh cookie on every valid request
  const expiryMs = Date.now() + SESSION_MINUTES * 60 * 1000;
  const res = NextResponse.next();
  res.cookies.set('jfint_auth', expected!, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MINUTES * 60,
    path: '/',
  });
  // Non-httpOnly expiry hint so the client timer can read the real expiry without a fetch
  res.cookies.set('jfint_auth_exp', String(expiryMs), {
    httpOnly: false,
    sameSite: 'lax',
    maxAge: SESSION_MINUTES * 60,
    path: '/',
  });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
