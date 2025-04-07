'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FaHeart } from 'react-icons/fa';

const metadata = {
  loading: {
    title: 'E-posta Doğrulanıyor | CrushIt'
  },
  success: {
    title: 'E-posta Doğrulandı | CrushIt'
  },
  error: {
    title: 'Doğrulama Hatası | CrushIt'
  }
};

// Client component that uses useSearchParams
function VerifyContent() {
  const searchParams = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    document.title = metadata[verificationStatus].title;
  }, [verificationStatus]);

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setVerificationStatus('error');
        return;
      }
      
      try {
        // Updated path to match backend route
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/verify?token=${token}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        const data = await response.json();

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (response.ok) {
          setVerificationStatus('success');
        } else {
          console.error('Verification failed:', data);
          setVerificationStatus('error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('error');
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1C1C1E] via-[#8A2BE2]/10 to-[#D63384]/10">
      <div className="bg-white/10 backdrop-blur-sm p-8 rounded-lg shadow-xl max-w-md w-full text-center border border-pink-500/20">
        {verificationStatus === 'loading' && (
          <div>
            <div className="animate-pulse text-pink-500 text-6xl mb-4">
              <FaHeart className="mx-auto" />
            </div>
            <p className="mt-4 text-white">Aşka giden yolda son bir adım...</p>
          </div>
        )}

        {verificationStatus === 'success' && (
          <div>
            <div className="text-pink-500 text-6xl mb-4 animate-bounce">
              <FaHeart className="mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Hoş Geldiniz!</h1>
            <p className="mt-2 text-pink-200">Email adresiniz doğrulandı. Artık aşkı bulma yolculuğunuz başlayabilir!</p>
          </div>
        )}

        {verificationStatus === 'error' && (
          <div>
            <div className="text-red-500 text-6xl mb-4">✕</div>
            <h1 className="text-2xl font-bold text-white mb-2">Bir Sorun Oluştu</h1>
            <p className="mt-2 text-pink-200">Doğrulama bağlantınız geçersiz veya süresi dolmuş olabilir.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main page component with Suspense
export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1C1C1E] via-[#8A2BE2]/10 to-[#D63384]/10">
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-lg shadow-xl max-w-md w-full text-center border border-pink-500/20">
          <div className="animate-pulse text-pink-500 text-6xl mb-4">
            <FaHeart className="mx-auto" />
          </div>
          <p className="mt-4 text-white">Yükleniyor...</p>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}