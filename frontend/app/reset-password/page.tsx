"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { Metadata } from 'next'



const metadata: Metadata = {
  title: "Şifre Sıfırlama - CrushIt",
  description: "Yeni şifrenizi belirleyin ve hesabınıza tekrar giriş yapın.",
}

const ResetPasswordPage = () => {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = metadata.title as string;
  }
  , []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validation
    if (password.length < 8) {
      toast.error("Şifre en az 8 karakter olmalıdır.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Şifreler eşleşmiyor.");
      setIsLoading(false);
      return;
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        toast.error("Geçersiz şifre sıfırlama bağlantısı.");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Şifreniz başarıyla güncellendi!");
        setTimeout(() => {
          router.push("/signin");
        }, 2000);
      } else {
        toast.error(data.detail?.[0]?.msg || "Şifre sıfırlama başarısız oldu.");
      }
    } catch (error) {
      toast.error("Bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-[#2C2C2E] p-8 rounded-lg">
          <h2 className="text-center text-3xl font-bold text-white">
            Yeni Şifre Belirleme
          </h2>
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div className="mb-4">
                <label htmlFor="password" className="text-sm text-gray-300">
                  Yeni Şifre
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none focus:border-[#D63384]"
                  placeholder="********"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="confirmPassword" className="text-sm text-gray-300">
                  Şifre Tekrar
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none focus:border-[#D63384]"
                  placeholder="********"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 rounded-lg bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white font-medium hover:opacity-90 focus:outline-none disabled:opacity-50"
            >
              {isLoading ? "İşlem yapılıyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ResetPasswordPage;