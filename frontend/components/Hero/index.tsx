"use client"

import Link from "next/link";
import Image from "next/image";

const Hero = () => {
  return (
    <>
      <section
        id="home"
        className="relative z-10 overflow-hidden pb-16 pt-[120px] md:pb-[170px] md:pt-[150px] xl:pb-[220px] xl:pt-[180px] 2xl:pb-[200px] 2xl:pt-[210px]"
      >
        {/* Background Image */}
        <div className="absolute inset-0 z-[-2]">
          <Image
            src="/images/hero/hero-2.webp"
            alt="Hero Background"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-black/90 blur-[20px] animate-pulse shadow-[inset_0_0_100px_rgba(138,43,226,0.3)] transition-all duration-1000"></div>
        </div>

        <div className="container">
          <div className="-mx-4 flex flex-wrap">
            <div className="w-full px-4">
              <div
                className="wow fadeInUp mx-auto max-w-[800px] text-center"
                data-wow-delay=".2s"
              >
                <h1 className="mb-5 text-4xl font-bold leading-tight text-white sm:text-5xl sm:leading-tight md:text-6xl md:leading-tight">
                  Aşkı Keşfetmenin Modern Yolu
                </h1>
                <p className="mb-12 text-base !leading-relaxed text-gray-300 sm:text-lg md:text-xl">
                  Gerçek bağlantılar kurun, özel anlar yaşayın. Modern dünyada aşkı bulmanın en şık ve güvenli yolu.
                </p>
                <div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                  <Link href="/signup">
                    <p className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-white bg-gradient-to-r from-[#8A2BE2] to-[#D63384] rounded-full cursor-pointer hover:shadow-[0_0_15px_rgba(138,43,226,0.5)] hover:scale-105 transition duration-300 ease-in-out transform">
                      Yolculuğa Başla
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background gradients */}
        <div className="absolute right-0 top-0 z-[-1] opacity-30 lg:opacity-100">
          <div className="h-[500px] w-[500px] rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#00CED1] opacity-20 blur-[120px]"></div>
        </div>
        <div className="absolute bottom-0 left-0 z-[-1] opacity-30 lg:opacity-100">
          <div className="h-[500px] w-[500px] rounded-full bg-gradient-to-r from-[#D63384] to-[#FFD700] opacity-20 blur-[120px]"></div>
        </div>
      </section>
    </>
  );
};

export default Hero;