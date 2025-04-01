import React from 'react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface OAuthButtonsProps {
  onStart?: () => void;
}

const OAuthButtons = ({ onStart }: OAuthButtonsProps) => {
  const start42Auth = async () => {
    try {
      if (onStart) onStart();
      
      // Request authorization URL from backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/auth/oauth/42`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start OAuth flow');
      }

      const data = await response.json();
      
      // Store state in localStorage to verify when returning from OAuth provider
      localStorage.setItem('oauth_state', data.state);
      
      // Redirect to 42's authorization page
      window.location.href = data.authorize_url;
      
    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      toast.error('OAuth girişi başlatılamadı');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-center">
        <span className="hidden h-[1px] w-full max-w-[60px] bg-gray-600 sm:block"></span>
        <p className="w-full px-5 text-center text-base font-medium text-gray-400">
          veya hesabınızla giriş yapın
        </p>
        <span className="hidden h-[1px] w-full max-w-[60px] bg-gray-600 sm:block"></span>
      </div>
      
      <button
        onClick={start42Auth}
        className="flex w-full h-12 items-center justify-center space-x-3 rounded-lg border border-[#3C3C3E] bg-[#2C2C2E] px-6 py-3 text-base transition-colors duration-300 hover:bg-[#3C3C3E]"
      >
        <Image 
          src="/images/42-logo.svg" 
          alt="42 School" 
          width={20} 
          height={20} 
          unoptimized 
        />
        <span className="text-white">42 ile Giriş Yap</span>
      </button>
    </div>
  );
};

export default OAuthButtons;