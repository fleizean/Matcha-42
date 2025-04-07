"use client";

import { AnimatePresence, motion } from "framer-motion";
import SectionTitle from "../Common/SectionTitle";
import { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const successStories = [
  {
    id: 1,
    name: "Ayşe & Mehmet",
    story: "6 ay önce burada tanıştık ve şimdi nişanlıyız! Birbirimizi bulmamıza yardımcı olduğunuz için teşekkürler.",
    image: "https://i.pinimg.com/originals/31/f5/77/31f57728a8082e0dfaad70e0467c46f4.jpg",
    date: "Ocak 2024"
  },
  {
    id: 2,
    name: "Can & Elif",
    story: "İlk mesajdan evliliğe uzanan bir hikaye. Aşkı bulmanın en güzel yolu!",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQMOILJ_-awquIk7b0mux9gUSQlFot97IWPw&s",
    date: "Mart 2024"
  },
  {
    id: 3,
    name: "Deniz & Zeynep",
    story: "Ortak ilgi alanlarımız bizi bir araya getirdi. Artık hayatımızı birlikte planlıyoruz.",
    image: "https://st.depositphotos.com/1017986/4754/i/450/depositphotos_47543589-stock-photo-romantic-happy-couple-hugging-in.jpg",
    date: "Şubat 2024"
  }
];

const SuccessStories = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? successStories.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === successStories.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="relative z-10 py-16 md:py-20 lg:py-28 bg-gradient-to-br from-[#1C1C1E] via-[#8A2BE2]/10 to-[#D63384]/10">
      <div className="container">
        <SectionTitle
          title="Başarı Hikayeleri"
          paragraph="Platformumuzda başlayan aşk hikayeleri ile tanışın"
          center
          width="665px"
          className="text-white"
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="relative w-full md:w-3/4 lg:w-1/2 mx-auto max-w-3xl"
          >
            <div className="bg-gradient-to-r from-[#8A2BE2]/10 to-[#D63384]/10 rounded-xl shadow-lg p-8 backdrop-blur-sm">
              <div className="text-center mb-8">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-[#D63384]">
                  <img
                    src={successStories[currentIndex].image}
                    alt={successStories[currentIndex].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">
                  {successStories[currentIndex].name}
                </h3>
                <p className="text-gray-300 mb-4">
                  {successStories[currentIndex].story}
                </p>
                <span className="text-[#D63384] font-medium">
                  {successStories[currentIndex].date}
                </span>
              </div>

              <div className="flex items-center justify-between mt-8">
                <button 
                  onClick={handlePrev}
                  className="p-2 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white hover:shadow-[0_0_15px_rgba(138,43,226,0.5)]"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>

                <div className="flex space-x-2">
                  {successStories.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        idx === currentIndex 
                          ? 'bg-[#D63384] w-4' 
                          : 'bg-gray-500'
                      }`}
                    />
                  ))}
                </div>

                <button 
                  onClick={handleNext}
                  className="p-2 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white hover:shadow-[0_0_15px_rgba(138,43,226,0.5)]"
                >
                  <FiArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default SuccessStories;