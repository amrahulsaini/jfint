import { NextRequest, NextResponse } from 'next/server';

// Verification is now handled inline on the portal page via a modal overlay.
// The proxy just lets everything through.
export default function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};