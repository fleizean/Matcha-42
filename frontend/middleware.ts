import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

async function refreshToken(refreshToken: string): Promise<RefreshTokenResponse | null> {
  try {
    // Call the backend API to refresh the token
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export default withAuth(
  async function middleware(req) {
    const authPages = ["/signin", "/signup", "/forgot-password"];
    const isAuthPage = authPages.includes(req.nextUrl.pathname);
    const token = req.nextauth?.token;
    
    // Korunan sayfaları kontrol et (chat ve diğerleri)
    const protectedPages = ["/match", "/settings", "/chat", "/first-time"];
    const isProtectedPage = protectedPages.some(page => 
      req.nextUrl.pathname === page || req.nextUrl.pathname.startsWith(`${page}/`)
    );

    // Token yoksa ve korunan bir sayfadaysa, giriş sayfasına yönlendir
    if (isProtectedPage && !token) {
      return NextResponse.redirect(new URL("/signin", req.url));
    }

    // Profile path handling
    if (req.nextUrl.pathname.startsWith('/profile')) {
      const segments = req.nextUrl.pathname.split('/');
      const username = segments[2];

      // Check if path has username
      if (segments.length > 2 && username) {
        if (!token) {
          return NextResponse.redirect(new URL("/signin", req.url));
        }

        try {
          // Check if profile exists
          const profileCheckResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/check-real-profile/${username}`,
            {
              headers: {
                Authorization: `Bearer ${token.accessToken}`,
              },
            }
          );

          if (!profileCheckResponse.ok) {
            // Profile doesn't exist, redirect to 404
            return NextResponse.redirect(new URL("/404", req.url));
          }

          const result = await profileCheckResponse.json();
          if (!result.exists) {
            return NextResponse.redirect(new URL("/404", req.url));
          }
        } catch (error) {
          console.error('Profile check error:', error);
          return NextResponse.redirect(new URL("/404", req.url));
        }
      } else {
        return token 
          ? NextResponse.redirect(new URL("/match", req.url))
          : NextResponse.redirect(new URL("/signin", req.url));
      }
    }

    // Token expiration check
    if (token?.expiration && Date.now() >= new Date(token.expiration).getTime()) {
      // Don't try to refresh token for API routes or next internal routes
      const isNextInternalRoute = req.nextUrl.pathname.startsWith('/_next/') || 
                                  req.nextUrl.pathname.includes('/__nextjs_');
      
      // Only attempt refresh for actual page navigations, not for internal Next.js requests
      if (!isNextInternalRoute && token.refreshToken && !req.headers.get('x-middleware-refresh')) {
        try {
          const newTokens = await refreshToken(token.refreshToken);
          
          if (newTokens) {
            // Continue with the request as the token was refreshed
            // Add a custom header to prevent refresh loops
            const headers = new Headers(req.headers);
            headers.set('x-middleware-refresh', '1');
            
            const response = NextResponse.next({
              request: {
                headers
              }
            });
            
            return response;
          }
        } catch (error) {
          console.error('Token refresh error in middleware:', error);
        }
      }
      
      // If refresh failed, no refresh token, or already attempted refresh, redirect to login
      if (!isAuthPage && req.nextUrl.pathname !== "/" && !isNextInternalRoute) {
        const response = NextResponse.redirect(new URL("/signin", req.url));
        
        response.cookies.delete("next-auth.session-token");
        response.cookies.delete("next-auth.callback-url");
        response.cookies.delete("accessToken");
        
        return response;
      }
    }

    if (token && req.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/match", req.url));
    }

    if (token && isAuthPage) {
      return NextResponse.redirect(new URL("/match", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/signin",
    "/signup", 
    "/match",
    "/first-time",
    "/forgot-password",
    "/profile/:path*",
    "/settings",
    "/chat",
    "/chat/:path*",
  ]
};