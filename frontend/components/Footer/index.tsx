import Image from "next/image";
import Link from "next/link";
import { FaInstagram, FaTwitter, FaGithub } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="relative z-10 bg-[#1C1C1E] pt-16 md:pt-20 lg:pt-24">
      <div className="container">
        <div className="-mx-4 flex flex-wrap">
          {/* Logo and Company Info */}
          <div className="w-full px-4 md:w-1/2 lg:w-4/12 xl:w-5/12">
            <div className="mb-12 max-w-[360px] lg:mb-16">
              <Link href="/" className="mb-8 inline-block">
                <Image
                  src="/images/logo/logo.svg"
                  alt="logo"
                  width={160}
                  height={50}
                  className="dark:hidden"
                />
                <Image
                  src="/images/logo/logo.svg"
                  alt="logo"
                  width={160}
                  height={50}
                  className="hidden dark:block"
                />
              </Link>
              <p className="mb-9 text-base leading-relaxed text-gray-300">
                Modern dünyada aşkı bulmanın en şık ve güvenli yolu. Gerçek bağlantılar kurun, 
                özel anlar yaşayın.
              </p>
              <div className="flex items-center space-x-4">
                <a 
                  href="https://twitter.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#D63384] hover:text-white transition-colors duration-300"
                >
                  <FaTwitter size={20} />
                </a>
                <a 
                  href="https://instagram.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#D63384] hover:text-white transition-colors duration-300"
                >
                  <FaInstagram size={20} />
                </a>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#D63384] hover:text-white transition-colors duration-300"
                >
                  <FaGithub size={20} />
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12">
            <div className="mb-12 lg:mb-16">
              <h2 className="mb-10 text-xl font-bold text-white">
                Hızlı Erişim
              </h2>
              <ul>
                <li>
                  <Link
                    href="/about"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    Hakkımızda
                  </Link>
                </li>
                <li>
                  <Link
                    href="/success-stories"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    Başarı Hikayeleri
                  </Link>
                </li>
                <li>
                  <Link
                    href="/safety"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    Güvenlik İpuçları
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Legal Links */}
          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-2/12 xl:w-2/12">
            <div className="mb-12 lg:mb-16">
              <h2 className="mb-10 text-xl font-bold text-white">
                Yasal
              </h2>
              <ul>
                <li>
                  <Link
                    href="/terms"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    Kullanım Koşulları
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    Gizlilik Politikası
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cookie-policy"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    Çerez Politikası
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Support Links */}
          <div className="w-full px-4 sm:w-1/2 md:w-1/2 lg:w-3/12 xl:w-3/12">
            <div className="mb-12 lg:mb-16">
              <h2 className="mb-10 text-xl font-bold text-white">
                Destek
              </h2>
              <ul>
                <li>
                  <a
                    href="mailto:destek.tinder42@gmail.com"
                    className="mb-4 inline-block text-base text-gray-300 duration-300 hover:text-[#D63384]"
                  >
                    destek.tinder42@gmail.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#8A2BE2]/20 to-transparent"></div>
        
        {/* Copyright */}
        <div className="py-8">
          <p className="text-center text-base text-gray-300">
            © {new Date().getFullYear()} CrushIt. Tüm hakları saklıdır.
          </p>
        </div>
      </div>

      {/* Background Effects */}
      <div className="absolute bottom-0 left-0 z-[-1] opacity-30 lg:opacity-100">
        <div className="h-[300px] w-[300px] rounded-full bg-gradient-to-r from-[#D63384] to-[#FFD700] opacity-20 blur-[120px]"></div>
      </div>
      <div className="absolute top-0 right-0 z-[-1] opacity-30 lg:opacity-100">
        <div className="h-[300px] w-[300px] rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#00CED1] opacity-20 blur-[120px]"></div>
      </div>
    </footer>
  );
};

export default Footer;