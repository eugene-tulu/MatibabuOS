import { NextRequest, NextResponse } from 'next/server';

// Protected routes that require authentication and valid clinic
const protectedRoutes = ['/'];

export function middleware(request: NextRequest) {
  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route) && 
    route !== '/' || // Allow the root path to be handled separately
    request.nextUrl.pathname === route
  );

  // For now, we'll just check if the user has an active clinic
  // In a real implementation, we'd check authentication tokens and clinic access
  
  if (isProtectedRoute) {
    // Check if user has an active clinic in localStorage
    // Note: In a real implementation, we'd use cookies or server-side auth
    
    // For now, just allow everything to pass through
    // The actual validation will happen in the components
    return NextResponse.next();
  }

  // Allow public routes to pass through
  return NextResponse.next();
}

// Routes that the middleware should not run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};