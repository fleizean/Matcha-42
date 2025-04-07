"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

// This component will use the searchParams
function OAuthCallbackHandler() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const processOAuthCallback = async () => {
      try {
        // Get the code and state from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        
        // Get the original state from localStorage
        const savedState = localStorage.getItem('oauth_state');
        localStorage.removeItem('oauth_state'); // Clear it immediately
        
        // Validate state parameter to prevent CSRF attacks
        if (!state || state !== savedState) {
          setError('Geçersiz durum parametresi. Güvenlik ihlali tespit edildi.');
          setIsProcessing(false);
          return;
        }
        
        if (!code) {
          setError('Yetkilendirme kodu eksik');
          setIsProcessing(false);
          return;
        }
        
        // Exchange code for tokens via backend
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/oauth/42/callback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          }
        );
        
        if (!response.ok) {
          const errData = await response.json();
          console.error('OAuth callback error details:', errData);
          
          // Format the error message correctly
          let errorMessage = 'OAuth callback failed';
          if (errData.detail) {
            errorMessage = typeof errData.detail === 'string' 
              ? errData.detail 
              : Array.isArray(errData.detail)
                ? errData.detail.map(err => err.msg || JSON.stringify(err)).join(', ')
                : JSON.stringify(errData.detail);
          }
          
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Sign in using NextAuth credentials provider with access token
        const result = await signIn('credentials', {
          usernameOrEmail: 'oauth-user',  // This is just a placeholder
          password: 'unused',  // This won't be checked for OAuth logins
          loginType: 'oauth',
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          redirect: false,
        });
        
        if (result?.error) {
          throw new Error(result.error);
        }
        
        // Clear any previous loading toasts
        toast.dismiss();
        
        // Show welcome message
        if (data.is_new_user) {
          toast.success('Hoş geldin! Hesabın başarıyla oluşturuldu.');
          // Redirect to profile completion page for new users
          router.push('/settings');
        } else {
          toast.success('Başarıyla giriş yaptın!');
          // Redirect to match page for existing users
          router.push('/match');
        }
        
      } catch (error) {
        console.error('OAuth callback error:', error);
        setError(error instanceof Error ? error.message : 'OAuth girişinde bir hata oluştu');
        toast.error('Giriş yapılırken bir hata oluştu');
      } finally {
        setIsProcessing(false);
      }
    };
    
    processOAuthCallback();
  }, [searchParams, router]);
  
  return (
    <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#2C2C2E] p-8 rounded-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            {isProcessing ? 'Giriş Yapılıyor...' : error ? 'Giriş Başarısız' : 'Giriş Başarılı'}
          </h1>
          
          {isProcessing && (
            <div className="flex flex-col items-center justify-center">
              <LoadingSpinner />
              <p className="text-gray-300 mt-4">
                42 hesabınızla giriş yapılıyor. Lütfen bekleyin...
              </p>
            </div>
          )}
          
          {error && (
            <div className="text-center text-red-500">
              <p className="mb-4">{error}</p>
              <button
                onClick={() => router.push('/signin')}
                className="px-4 py-2 bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white rounded-lg"
              >
                Giriş Sayfasına Dön
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function CallbackLoading() {
  return (
    <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner />
        <p className="text-gray-300 mt-4">Yükleniyor...</p>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function OAuth42CallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <OAuthCallbackHandler />
    </Suspense>
  );
}