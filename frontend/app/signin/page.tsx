"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast, Toaster } from "react-hot-toast";
import { Metadata } from 'next'
import { FiEye, FiEyeOff } from "react-icons/fi";
import OAuthButtons from "@/components/Auth/OAuthButtons";

const metadata: Metadata = {
  title: 'Giriş Yap | CrushIt',
  description: 'Modern dünyada aşkı bulmanın en romantik yolu. Hemen giriş yapın ve yeni insanlarla tanışın.',
  openGraph: {
    title: 'Giriş Yap | CrushIt',
    description: 'Modern dünyada aşkı bulmanın en romantik yolu. Hemen giriş yapın ve yeni insanlarla tanışın.',
    type: 'website',
  },
}


const SigninPage = () => {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);



  useEffect(() => {
    document.title = metadata.title as string;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", metadata.description as string);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = metadata.description as string;
      document.head.appendChild(meta);
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usernameOrEmail || !password) {
      toast.error("Lütfen tüm alanları doldurunuz.");
      return;
    }

    try {
    
      // Modify NextAuth signIn call with token
      const result = await signIn("credentials", {
        usernameOrEmail,
        password,
        redirect: false,
        callbackUrl: '/match'
      });
    
      if (!result?.ok) {
        if (result?.error === "CredentialsSignin") {
          toast.error("Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
          return;
        }
        toast.error(result.error || "Giriş sırasında bir hata oluştu.");
        return;
      }
    
      toast.success("Giriş başarılı! Yönlendiriliyorsunuz...");
      router.push("/match");
    
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Giriş sırasında bir hata oluştu.");
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
                  Giriş Yapın
                </h3>
                <p className="mb-11 text-center text-base font-medium text-gray-300">
                  Hemen giriş yapın ve yeni insanlarla tanışın.
                </p>

                <OAuthButtons onStart={() => {
                  toast.loading('42 hesabınızla giriş yapılıyor...', {
                    duration: 10000,
                  });
                }} />               

                <div className="mb-8 flex items-center justify-center">
                  <span className="hidden h-[1px] w-full max-w-[70px] bg-gray-600 sm:block"></span>
                  <p className="w-full px-5 text-center text-base font-medium text-gray-400">
                    Kullanıcı adınız ve Şifrenizle Giriş Yapın
                  </p>
                  <span className="hidden h-[1px] w-full max-w-[70px] bg-gray-600 sm:block"></span>
                </div>
                <form onSubmit={handleSignIn}>
                  <div className="mb-8">
                    <label htmlFor="email" className="mb-3 block text-sm text-gray-300">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      placeholder="Kullanıcı adınızı giriniz"
                      autoComplete="username"
                      className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                    />
                  </div>

                  <div className="mb-8 relative">
                    <label htmlFor="password" className="mb-3 block text-sm text-gray-300">
                      Şifreniz
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Şifrenizi girin"
                        autoComplete="current-password"
                        className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPassword ? (
                          <FiEyeOff className="w-5 h-5" />
                        ) : (
                          <FiEye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-8 flex flex-col sm:flex-row sm:justify-end sm:items-center">
                    <div>
                      <a href="/forgot-password" className="text-sm font-medium text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-300">
                        Şifrenizi mi unuttunuz?
                      </a>
                    </div>
                  </div>

                  <div className="mb-6">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#8A2BE2] to-[#D63384] px-9 py-4 text-base font-medium text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(138,43,226,0.3)] hover:scale-[1.02]"
                    >
                      Giriş Yap
                    </button>
                  </div>
                </form>

                <p className="text-center text-base font-medium text-gray-400">
                  Hesabınız yok mu?{" "}
                  <Link href="/signup" className="text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-300">
                    Kayıt Ol
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
            <mask
              id="mask0_95:1005"
              style={{ maskType: "alpha" }}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="1440"
              height="969"
            >
              <rect width="1440" height="969" fill="#090E34" />
            </mask>
            <g mask="url(#mask0_95:1005)">
              <path
                opacity="0.1"
                d="M1086.96 297.978L632.959 554.978L935.625 535.926L1086.96 297.978Z"
                fill="url(#paint0_linear_95:1005)"
              />
              <path
                opacity="0.1"
                d="M1324.5 755.5L1450 687V886.5L1324.5 967.5L-10 288L1324.5 755.5Z"
                fill="url(#paint1_linear_95:1005)"
              />
            </g>
            <defs>
              <linearGradient
                id="paint0_linear_95:1005"
                x1="1178.4"
                y1="151.853"
                x2="780.959"
                y2="453.581"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_95:1005"
                x1="160.5"
                y1="220"
                x2="1099.45"
                y2="1192.04"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>
    </>
  );
};

export default SigninPage;
