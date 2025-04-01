"use client";

import { Metadata } from 'next'

const metadata: Metadata = {
  title: 'Kayıt Ol | CrushIt',
  description: 'Modern dünyada aşkı bulmanın en romantik yolu. Hemen kayıt olun ve yeni insanlarla tanışın.',
  openGraph: {
    title: 'Kayıt Ol | CrushIt',
    description: 'Modern dünyada aşkı bulmanın en romantik yolu. Hemen kayıt olun ve yeni insanlarla tanışın.',
    type: 'website',
  },
}

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { signIn } from "next-auth/react";
import OAuthButtons from "@/components/Auth/OAuthButtons";
import { FiEye, FiEyeOff } from "react-icons/fi";

const SignupPage = () => {
  const router = useRouter();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [hasAcceptedPolicy, setHasAcceptedPolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);


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
  }, [metadata]);

    const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    // Form validation stays the same
    if (!name || !surname || !username || !email || !password || !passwordConfirm) {
      toast.error("Lütfen tüm alanları doldurunuz.");
      return;
    }
  
    if (password !== passwordConfirm) {
      toast.error("Şifreler uyuşmuyor.");
      return;
    }
  
    if (!hasAcceptedPolicy) {
      toast.error("Şartlar ve koşulları kabul etmelisiniz.");
      return;
    }
  
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          first_name: name,
          last_name: surname,
          username,
          email,
          password,
          is_active: true,
        }),
      });
  
      // API yanıtını JSON olarak parse et (başarılı veya başarısız olsun)
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError);
        data = {}; // Parse edilemezse boş bir nesne kullan
      }
  
      if (!response.ok) {
        // API'den gelen hata mesajını gösterelim
        if (data.detail) {
          setError(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
          toast.error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail));
        } else {
          const errorMsg = `Kayıt olurken bir hata oluştu. (${response.status}: ${response.statusText})`;
          setError(errorMsg);
          toast.error(errorMsg);
        }
        return;
      }
        
      // Kaydolma başarılı
      toast.success("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...");
      router.push("/signin");
    } catch (error) {
      // Bu catch bloğu sadece ağ hataları (network errors) içindir
      console.error("Network error during signup:", error);
      const errorMessage = error instanceof Error ? 
        `Bağlantı hatası: ${error.message}` : 
        "Sunucuyla bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edin.";
      
      setError(errorMessage);
      toast.error(errorMessage);
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
                  Hesap Oluştur
                </h3>
                {error && (
                  <p className="mb-4 text-center text-sm text-red-600">{error}</p>
                )}

                <p className="mb-11 text-center text-base font-medium text-gray-300">
                  Hemen üye olun ve yeni insanlarla tanışın.
                </p>
                <OAuthButtons onStart={() => {
                  toast.loading('42 hesabınızla kayıt olunuyor...', {
                    duration: 10000,
                  });
                }} />


                <div className="mb-8 flex items-center justify-center">
                  <span className="hidden h-[1px] w-full max-w-[60px] bg-gray-600 sm:block"></span>
                  <p className="w-full px-5 text-center text-base font-medium text-gray-400">
                    E-posta ile kayıt ol
                  </p>
                  <span className="hidden h-[1px] w-full max-w-[60px] bg-gray-600 sm:block"></span>
                </div>

                <form onSubmit={handleSignup}>
                  {/* Input fields template - repeat for all inputs */}
                  <div className="flex gap-4 mb-8">
                    <div className="flex-1">
                      <label htmlFor="name" className="mb-3 block text-sm text-gray-300">
                        Adınız
                      </label>
                      <input
                        type="text"
                        name="name"
                        placeholder="Adınızı Girin"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="surname" className="mb-3 block text-sm text-gray-300">
                        Soyadınız
                      </label>
                      <input
                        type="text"
                        name="surname"
                        placeholder="Soyadınızı Girin"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                      />
                    </div>
                  </div>
                  <div className="mb-8">
                    <label htmlFor="username" className="mb-3 block text-sm text-gray-300">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      name="username"
                      placeholder="Kullanıcı Adınızı Girin"
                      value={username}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                    />
                  </div>
                  <div className="mb-8">
                    <label
                      htmlFor="email"
                      className="mb-3 block text-sm text-gray-300"
                    >
                      {" "}
                      Mail Adresiniz{" "}
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="Mail Adresinizi Girin"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                    />
                  </div>
                  <div className="mb-8">
                    <label htmlFor="password" className="mb-3 block text-sm text-gray-300">
                      Şifreniz
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Şifrenizi Girin"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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

                  <div className="mb-8">
                    <label htmlFor="passwordConfirm" className="mb-3 block text-sm text-gray-300">
                      Şifre Onayla
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordConfirm ? "text" : "password"}
                        name="passwordConfirm"
                        placeholder="Şifrenizi Tekrar Girin"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full rounded-lg border border-transparent bg-[#3C3C3E] px-6 py-3 text-base text-white outline-none transition-all duration-300 focus:border-[#D63384] focus:shadow-[0_0_0_2px_rgba(214,51,132,0.2)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPasswordConfirm ? (
                          <FiEyeOff className="w-5 h-5" />
                        ) : (
                          <FiEye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mb-8 flex">
                    <label className="flex cursor-pointer select-none text-sm font-medium text-gray-300">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="checkboxLabel"
                          className="sr-only"
                          checked={hasAcceptedPolicy}
                          onChange={(e) => setHasAcceptedPolicy(e.target.checked)}
                        />
                        <div className="box mr-4 mt-1 flex h-5 w-5 items-center justify-center rounded border border-[#D63384] border-opacity-20">
                          <span className="opacity-0">
                            <svg
                              width="11"
                              height="8"
                              viewBox="0 0 11 8"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M10.0915 0.951972L10.0867 0.946075L10.0813 0.940568C9.90076 0.753564 9.61034 0.753146 9.42927 0.939309L4.16201 6.22962L1.58507 3.63469C1.40401 3.44841 1.11351 3.44879 0.932892 3.63584C0.755703 3.81933 0.755703 4.10875 0.932892 4.29224L0.932878 4.29225L0.934851 4.29424L3.58046 6.95832C3.73676 7.11955 3.94983 7.2 4.1473 7.2C4.36196 7.2 4.55963 7.11773 4.71406 6.9584L10.0468 1.60234C10.2436 1.4199 10.2421 1.1339 10.0915 0.951972ZM4.2327 6.30081L4.2317 6.2998C4.23206 6.30015 4.23237 6.30049 4.23269 6.30082L4.2327 6.30081Z"
                                fill="#3056D3"
                                stroke="#3056D3"
                                strokeWidth="0.4"
                              />
                            </svg>
                          </span>
                        </div>
                      </div>
                      <span>
                        Hesap oluşturarak
                        <a href="/terms" className="text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-300">
                          {" "}
                          Şartlar ve Koşullar{" "}
                        </a>
                        ı ve
                        <a href="/privacy" className="text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-300">
                          {" "}
                          Gizlilik Politikası{" "}
                        </a>
                        nı kabul etmiş olursunuz.
                      </span>
                    </label>
                  </div>
                  <div className="mb-6">
                    <button type="submit" className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#8A2BE2] to-[#D63384] px-9 py-4 text-base font-medium text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(138,43,226,0.3)] hover:scale-[1.02]">
                      Kayıt Ol
                    </button>
                  </div>
                </form>
                <p className="text-center text-base font-medium text-body-color">
                  Hali hazırda bir hesabınız var mı?{" "}
                  <Link href="/signin" className="text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-300">
                    Giriş Yapın
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
              <linearGradient id="paint0_linear_95:1005" x1="1178.4" y1="151.853" x2="780.959" y2="453.581" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8A2BE2" />
                <stop offset="1" stopColor="#D63384" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="paint1_linear_95:1005" x1="160.5" y1="220" x2="1099.45" y2="1192.04" gradientUnits="userSpaceOnUse">
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

export default SignupPage;
