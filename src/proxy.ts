import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Keep the sign-in screen public. Every other workspace page needs a signed-in user.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)']);
const isApiRoute = createRouteMatcher(['/api(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next();

  const { userId } = await auth();
  if (userId) return NextResponse.next();

  // APIs must never redirect to an HTML login page.
  if (isApiRoute(request)) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }

  const signInUrl = new URL('/sign-in', request.url);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|webp|avif|gif|svg|ico|woff2?|ttf|map|txt)).*)',
    '/(api|trpc)(.*)',
  ],
};
