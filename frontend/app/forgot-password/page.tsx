"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";
import { Metadata } from "next";

const metadata: Metadata = {
  title: "Şifremi Unuttum - CrushIt",
  description: "Şifrenizi mi unuttunuz? E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.",
};


const ForgotPasswordPage = () => {
  const router = useRouter();
  const [mail, setEmail] = useState("");

  useEffect(() => {
    document.title = metadata.title as string;
  }
  , []);

    const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!mail) {
      toast.error("Lütfen e-posta adresinizi giriniz.");
      return;
    }
  
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail }), // Email'i JSON gövdesinde gönderiyoruz
      });
  
      if (res.ok) {
        toast.success("Şifre sıfırlama talimatları e-posta adresinize gönderildi.");
        setTimeout(() => {
          router.push("/signin");
        }, 2000);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.");
      }
    } catch (error) {
      toast.error("Bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.");
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <section className="relative z-10 overflow-hidden pb-16 pt-36 md:pb-20 lg:pb-28 lg:pt-[180px] bg-[#1C1C1E]">
        <div className="container">
          <div className="-mx-4 flex flex-wrap">
            <div className="w-full px-4">
              <div className="shadow-three mx-auto max-w-[500px] rounded bg-[#2C2C2E] px-6 py-10 sm:p-[60px]">
                <h3 className="mb-3 text-center text-2xl font-bold text-white sm:text-3xl">
                  Şifrenizi mi Unuttunuz?
                </h3>
                <p className="mb-11 text-center text-base font-medium text-gray-300">
                  E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
                </p>
                <form onSubmit={handleForgotPassword}>
                  <div className="mb-8">
                    <label className="mb-3 block text-sm text-gray-300">
                      E-posta Adresi
                    </label>
                    <input
                      type="email"
                      value={mail}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-posta adresinizi girin"
                      className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                    />
                  </div>
                  <div className="mb-6">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#8A2BE2] to-[#D63384] px-9 py-4 text-base font-medium text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(138,43,226,0.3)] hover:scale-[1.02]"
                    >
                      Şifremi Sıfırla
                    </button>
                  </div>
                </form>
                <p className="text-center text-base font-medium text-gray-400">
                  Şifrenizi hatırladınız mı?{" "}
                  <Link href="/signin" className="text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-300">
                    Giriş Yap
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute left-0 top-0 z-[-1]">
          <svg
            width="1440"
            height="969"
            viewBox="0 0 1440 969"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="paint0_linear_95:1005"
                x1="1178.4"
                y1="151.853"
                x2="780.959"
                y2="453.581"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#8A2BE2" />
                <stop offset="1" stopColor="#D63384" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_95:1005"
                x1="160.5"
                y1="220"
                x2="1099.45"
                y2="1192.04"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#D63384" />
                <stop offset="1" stopColor="#8A2BE2" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>
    </>
  );
};

export default ForgotPasswordPage;