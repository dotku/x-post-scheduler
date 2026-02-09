import { withMiddlewareAuthRequired } from "@auth0/nextjs-auth0/edge";

export default withMiddlewareAuthRequired();

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth/* (Auth0 authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login page
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
