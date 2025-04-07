import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

interface LoginError {
  error: string;
  status: number;
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Update the refreshAccessToken function
const refreshAccessToken = async (token: any) => {
  // Check if token exists
  if (!token) {
    return null;
  }
  
  // Check if a refresh is already in progress (prevent duplicate requests)
  if (token.refreshing) {
    return token;
  }

  try {
    console.log("Attempting to refresh access token");
    
    // Mark that we're refreshing
    token.refreshing = true;
    
    // Make sure refresh token exists
    if (!token.refreshToken) {
      throw new Error("No refresh token available");
    }
    
    // Make a request to the token endpoint with the refresh token
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: token.refreshToken,
      }),
      // Add a timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Token refresh failed with status:", response.status, errorData);
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const refreshedTokens: RefreshTokenResponse = await response.json();
    
    if (!refreshedTokens || !refreshedTokens.access_token || !refreshedTokens.refresh_token) {
      throw new Error("Invalid refresh response: missing tokens");
    }

    // Calculate expiration time based on JWT payload
    let expirationTime;
    try {
      const tokenData = JSON.parse(atob(refreshedTokens.access_token.split('.')[1]));
      expirationTime = tokenData && tokenData.exp ? tokenData.exp * 1000 : null;
    } catch (error) {
      console.error("Error parsing token expiration:", error);
      // Fallback expiration (15 minutes)
      expirationTime = Date.now() + 15 * 60 * 1000;
    }

    console.log("Token refreshed successfully");
    
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token,
      expiration: expirationTime ? new Date(expirationTime).toISOString() : null,
      refreshing: false,
      error: undefined, // Clear any previous errors
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    
    // The refresh token has expired or is invalid
    return {
      ...token,
      refreshing: false,
      error: "RefreshAccessTokenError",
    };
  }
};

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        usernameOrEmail: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        loginType: { label: "Login Type", type: "text" },
        accessToken: { label: "Access Token", type: "text" },
        refreshToken: { label: "Refresh Token", type: "text" }
      },
      async authorize(credentials) {
        try {
          // Check if this is an OAuth login
          if (credentials?.loginType === 'oauth') {
            // For OAuth logins, we've already validated at the backend
            // Just return a user object with the tokens
            return {
              id: 'oauth-user',  // Will be replaced by actual user data in session callback
              accessToken: credentials.accessToken,
              refreshToken: credentials.refreshToken,
              expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes from now
            };
          }
          
          // Regular username/password login
          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/login/json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              "Accept": "application/json"
            },
            body: JSON.stringify({
              username: credentials?.usernameOrEmail,
              password: credentials?.password,
            })
          });
      
          const data = await res.json();
      
          if (!res.ok) {
            return Promise.reject(new Error(data.detail));
          }
      
          if (data?.access_token) {
            const tokenData = JSON.parse(atob(data.access_token.split('.')[1]));
            const expirationTime = tokenData.exp * 1000;
      
            return {
              id: credentials?.usernameOrEmail || '1',
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiration: new Date(expirationTime).toISOString()
            };
          }
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    // Update the jwt callback with proper null checks
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.expiration = user.expiration;
        token.lastRefreshed = Date.now();
        return token;
      }

      // Handle token refresh
      if (trigger === "update") {
        // Force a token refresh when update() is called
        if (token && token.refreshToken) {
          // We keep track of when we last refreshed to prevent rapid successive refreshes
          const timeElapsed = Date.now() - (token.lastRefreshed as number || 0);
          if (timeElapsed < 30000) { // Don't refresh more than once every 30 seconds
            console.log("Skipping refresh - too soon since last refresh");
            return token;
          }
          
          console.log("Updating session via update() trigger");
          const refreshedToken = await refreshAccessToken(token);
          if (refreshedToken) { // Add null check here
            refreshedToken.lastRefreshed = Date.now();
          }
          return refreshedToken || token; // Return original token if refresh failed
        }
        return token;
      }

      // Check token expiration for normal requests
      if (token) { // Add null check for token
        const currentTime = Date.now();
        const expTime = token.expiration ? new Date(token.expiration).getTime() : 0;

        // If token expires in less than 2 minutes, refresh it proactively
        if (expTime > 0 && expTime < currentTime + 120000) {
          // Double-check that we haven't refreshed recently
          const timeElapsed = currentTime - (token.lastRefreshed as number || 0);
          if (timeElapsed < 30000) { // Don't refresh more than once every 30 seconds
            return token;
          }

          if (token.refreshToken) {
            console.log("Token expiring soon, refreshing proactively");
            const refreshedToken = await refreshAccessToken(token);
            if (refreshedToken) { // Add null check
              refreshedToken.lastRefreshed = currentTime;
              return refreshedToken;
            }
          }
        }
      }

      return token || {}; // Return empty object if token is null/undefined
    },
    // Update the session callback with proper null checks
    async session({ session, token }) {
      if (session && session.user && token) {
        session.user.accessToken = token.accessToken;
        session.user.refreshToken = token.refreshToken;
        session.user.expiration = token.expiration;
      }
      
      // If there was an error refreshing the token, redirect to sign in
      if (token && token.error) {
        return null; // Force re-authentication
      }
      
      return session;
    }
  },
  pages: {
    signIn: '/signin',
    error: '/404'
  },
  debug: process.env.NODE_ENV === 'development'
});

export { handler as GET, handler as POST };