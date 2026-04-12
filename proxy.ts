import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: home redirect, login page, auth API, student listing API, Next.js internals, static assets
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/db/students' ||
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

  // Session is fixed — expiry was set at login, do NOT slide it here.
  // The jfint_auth_exp cookie is already on the browser from login; just let the request through.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};