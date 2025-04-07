"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaGithub, FaGraduationCap, FaInstagram, FaSquareXTwitter } from "react-icons/fa6";
import { Metadata } from 'next'
import Image from 'next/image'


const metadata: Metadata = {
  title: 'Hakkımızda | CrushIt',
  description: 'Modern dünyada aşkı bulmanın en romantik yolu. Yeni insanlarla tanışın ve hayatınızın aşkını bulun.',
  openGraph: {
    title: 'Hakkımızda | CrushIt',
    description: 'Modern dünyada aşkı bulmanın en romantik yolu. Yeni insanlarla tanışın ve hayatınızın aşkını bulun.',
    type: 'website',
  },
}

const AboutPage = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);


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




  return (
    <section className="pt-[150px] pb-[120px] bg-[#1C1C1E]">
      <div className="bg-[#1C1C1E]">
        {/* Hero Section */}
        <section className="pt-[150px] pb-[60px]">
          <div className="container px-4 mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                CrushIt Hakkında
              </h1>
              <p className="text-lg text-gray-300 mb-8">
                Modern dünyada aşkı bulmanın en romantik yolu. Güvenli ve eğlenceli bir ortamda yeni insanlarla tanışın.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 bg-[#2C2C2E]">
          <div className="container px-4 mx-auto">
            <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-[#3C3C3E] p-8 rounded-lg shadow-lg"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Misyonumuz</h2>
                <p className="text-gray-300">
                  İnsanların gerçek aşkı bulmasına yardımcı olmak ve mutlu ilişkiler kurmalarını sağlamak.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-[#3C3C3E] p-8 rounded-lg shadow-lg"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Vizyonumuz</h2>
                <p className="text-gray-300">
                  Modern dünyanın en güvenilir ve saygın çevrimiçi tanışma platformu olmak.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 bg-[#2C2C2E]">
          <div className="container px-4 mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Neden CrushIt?
              </h2>
              <p className="text-gray-300">
                Güvenli ve samimi bir ortamda hayatınızın aşkını bulun.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {[
                {
                  title: 'Güvenli Ortam',
                  description: 'En üst düzey güvenlik önlemleriyle korunan bir platform.'
                },
                {
                  title: 'Akıllı Eşleşme',
                  description: 'Size en uygun adaylarla tanışmanızı sağlayan akıllı algoritma.'
                },
                {
                  title: 'Özel Profiller',
                  description: 'Kendinizi en iyi şekilde ifade edebileceğiniz detaylı profiller.'
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  className="bg-[#3C3C3E] p-8 rounded-lg shadow-lg hover:shadow-[0_0_20px_rgba(214,51,132,0.2)] transition-all duration-300"
                >
                  <h3 className="text-xl font-bold text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-300">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Our Team */}
        <section className="py-16 bg-[#2C2C2E]">
          <div className="container px-4 mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Ekibimiz
              </h2>
              <p className="text-gray-300">
                CrushIt&apos;i sizin için daha iyi hale getirmek için çalışan harika bir ekip.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Team Member 1 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-[#3A3A3C] rounded-xl overflow-hidden shadow-lg"
              >
                <div className="h-64 overflow-hidden" onClick={() => setSelectedImage("/images/team/member1.jpeg")}>
                  <Image
                    src="/images/team/member1.jpeg"
                    alt="Team Member"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-1">Enes yağız</h3>
                  <p className="text-purple-400 mb-4">Geliştirici</p>
                  <div className="flex space-x-4">
                    <a href="https://x.com/onlyflei" className="text-gray-400 hover:text-white transition-colors">
                      <FaSquareXTwitter />
                    </a>
                    <a href="https://www.instagram.com/fleizean/" className="text-gray-400 hover:text-white transition-colors">
                      <FaInstagram />
                    </a>
                    <a href="https://github.com/fleizean" className="text-gray-400 hover:text-white transition-colors">
                      <FaGithub />
                    </a>
                    <a href="https://profile.intra.42.fr/users/eyagiz" className="text-gray-400 hover:text-white transition-colors">
                      <FaGraduationCap />
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Team Member 2 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-[#3A3A3C] rounded-xl overflow-hidden shadow-lg"
              >
                <div className="h-64 overflow-hidden" onClick={() => setSelectedImage("/images/team/member2.jpeg")}>
                  <Image
                    src="/images/team/member2.jpeg"
                    alt="Team Member"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-1">Samet Çiftçi</h3>
                  <p className="text-purple-400 mb-4">Geliştirici</p>
                  <div className="flex space-x-4">

                    <a href="https://www.instagram.com/temasictfic/" className="text-gray-400 hover:text-white transition-colors">
                      <FaInstagram />
                    </a>
                    <a href="https://github.com/temasictfic/" className="text-gray-400 hover:text-white transition-colors">
                      <FaGithub />
                    </a>
                    <a href="https://profile.intra.42.fr/users/sciftci" className="text-gray-400 hover:text-white transition-colors">
                      <FaGraduationCap />
                    </a>
                  </div>
                </div>
              </motion.div>

            </div>

          </div>
        </section>
               {selectedImage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-[10000]"
                    onClick={() => setSelectedImage(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.8 }}
                      className="relative max-w-4xl max-h-[90vh]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Image
                        src={selectedImage}
                        alt="Full size"
                        className="max-w-full max-h-[90vh] object-contain"
                      />
                      <button
                        className="absolute top-2 right-2 bg-white bg-opacity-25 hover:bg-opacity-50 rounded-full p-2 text-white"
                        onClick={() => setSelectedImage(null)}
                      >
                        ✕
                      </button>
                    </motion.div>
                  </motion.div>
                )}
      </div>
    </section>
  );
};

export default AboutPage;