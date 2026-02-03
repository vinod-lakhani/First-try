import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and api routes.
     * Keeps middleware minimal so the server generates middleware-manifest.json.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
