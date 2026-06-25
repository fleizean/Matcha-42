"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { FiLoader, FiSliders, FiMapPin, FiHeart } from "react-icons/fi";
import { toast, Toaster } from "react-hot-toast";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";

interface UserProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  gender: string;
  sexual_preference: string;
  biography: string;
  latitude: number;
  longitude: number;
  fame_rating: number;
  birth_date: string;
  age?: number;
  distance?: number;
  has_liked?: boolean;
  pictures: {
    id: string;
    backend_url: string;
    is_primary: boolean;
  }[];
}

// Dynamically import UsersMap with SSR disabled (Leaflet requires window)
const UsersMap = dynamic(() => import("@/components/MapSelector/UsersMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-[#2C2C2E] rounded-2xl flex flex-col items-center justify-center gap-4 border border-[#3C3C3E]">
      <FiLoader className="w-12 h-12 text-[#D63384] animate-spin" />
      <p className="text-gray-400">Harita yükleniyor...</p>
    </div>
  ),
});

export default function MapPage() {
  const { data: session, status } = useSession();
  
  // Set document title
  useEffect(() => {
    document.title = "Harita | CrushIt";
  }, []);

  // State variables
  const [currentUserProfile, setCurrentUserProfile] = useState<{ latitude: number; longitude: number } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter states
  const DEFAULT_MIN_AGE = 18;
  const DEFAULT_MAX_AGE = 99;
  const DEFAULT_MIN_FAME = 0;
  const DEFAULT_MAX_FAME = 5;
  const DEFAULT_MAX_DISTANCE = 20000;

  const distanceOptions = [
    { label: "5 km (Aynı mahalle)", value: 5 },
    { label: "10 km (Yakın semtler)", value: 10 },
    { label: "25 km (Aynı şehir)", value: 25 },
    { label: "50 km (Şehir ve çevresi)", value: 50 },
    { label: "100 km (Komşu şehirler)", value: 100 },
    { label: "250 km (Aynı bölge)", value: 250 },
    { label: "500 km (Bölgeler arası)", value: 500 },
    { label: "1000 km (Ülke geneli)", value: 1000 },
    { label: "2500 km (Komşu ülkeler)", value: 2500 },
    { label: "5000 km (Kıtasal)", value: 5000 },
    { label: "10000 km (Global)", value: 10000 },
    { label: "20000 km (Dünya geneli)", value: 20000 }
  ];

  const [ageRange, setAgeRange] = useState([DEFAULT_MIN_AGE, DEFAULT_MAX_AGE]);
  const [fameRating, setFameRating] = useState([DEFAULT_MIN_FAME, DEFAULT_MAX_FAME]);
  const [distance, setDistance] = useState(DEFAULT_MAX_DISTANCE);
  const [tags, setTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const updateLocationOnBackend = async (lat: number, lng: number) => {
    if (!session?.user?.accessToken) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/location`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.user.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      if (response.ok) {
        setCurrentUserProfile({ latitude: lat, longitude: lng });
        toast.success("Konumunuz GPS aracılığıyla başarıyla güncellendi!");
      }
    } catch (error) {
      console.error("Failed to update location on backend:", error);
    }
  };

  const triggerBrowserGeolocation = useCallback(() => {
    if ("geolocation" in navigator) {
      toast.loading("GPS konumunuz alınıyor...", { id: "geo-toast" });
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          toast.dismiss("geo-toast");
          await updateLocationOnBackend(latitude, longitude);
        },
        (error) => {
          toast.dismiss("geo-toast");
          console.warn("Geolocation error:", error);
          toast.error("GPS konumu alınamadı. Lütfen tarayıcı izinlerini kontrol edin.");
        }
      );
    } else {
      toast.error("Tarayıcınız GPS konumunu desteklemiyor.");
    }
  }, [session]);

  // Fetch current user coordinates
  const fetchCurrentUserLocation = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me`, {
        headers: {
          Authorization: `Bearer ${session.user.accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          setCurrentUserProfile({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        } else {
          // Auto-trigger browser geolocation if coordinates are missing
          triggerBrowserGeolocation();
        }
      }
    } catch (error) {
      console.error("Error fetching current user location:", error);
    }
  }, [session, triggerBrowserGeolocation]);

  // Fetch suggested users around the location
  const fetchNearbyUsers = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: "500",
        max_distance: distance.toString(),
        min_age: ageRange[0].toString(),
        max_age: ageRange[1].toString(),
        min_fame: fameRating[0].toString(),
        max_fame: fameRating[1].toString(),
      });

      if (tags.length > 0) {
        tags.forEach(tag => {
          queryParams.append('tags', tag);
        });
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/suggested?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const errData = await response.json();
        toast.error(errData.detail || "Çevredeki kullanıcılar yüklenemedi");
      }
    } catch (error) {
      console.error("Error fetching suggested users:", error);
      toast.error("Bir ağ hatası oluştu");
    } finally {
      setIsLoading(false);
    }
  }, [session, distance, ageRange[0], ageRange[1], fameRating[0], fameRating[1], tags.join(",")]);

  // Initial load
  useEffect(() => {
    if (status === "authenticated") {
      fetchCurrentUserLocation();
    }
  }, [status, fetchCurrentUserLocation]);

  // Load nearby users once location is available
  useEffect(() => {
    if (currentUserProfile) {
      fetchNearbyUsers();
    }
  }, [currentUserProfile, fetchNearbyUsers]);

  // Handle Like/Unlike action inside Map Popups
  const handleLikeUser = async (userId: string): Promise<boolean> => {
    if (!session?.user?.accessToken) return false;
    
    // Find target user to determine if we are liking or unliking
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return false;

    const isLiking = !targetUser.has_liked;

    try {
      let response;
      if (isLiking) {
        // Like user
        response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/interactions/like`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ liked_id: userId }),
        });
      } else {
        // Unlike user
        response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/interactions/like/${userId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.user.accessToken}`,
          },
        });
      }

      if (response.ok) {
        const resData = await response.json();
        if (isLiking) {
          if (resData.is_match) {
            toast.success("Tebrikler! Karşılıklı eşleşme gerçekleşti! 🎉", { icon: "🔥" });
          } else {
            toast.success("Kullanıcı beğenildi!");
          }
        } else {
          toast.success("Beğeni geri çekildi.");
        }
        
        // Update local state
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, has_liked: isLiking } : u));
        return true;
      } else {
        const err = await response.json();
        toast.error(err.detail || "İşlem başarısız oldu");
        return false;
      }
    } catch (error) {
      console.error("Like error:", error);
      toast.error("Bir bağlantı hatası oluştu");
      return false;
    }
  };

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1C1C1E]">
        <FiLoader className="w-12 h-12 text-[#D63384] animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1C1C1E] text-white p-4">
        <h2 className="text-xl font-bold mb-4">Giriş Yapmanız Gerekiyor</h2>
        <p className="text-gray-400">Haritayı görüntülemek için lütfen önce hesabınıza giriş yapın.</p>
      </div>
    );
  }

  return (
    <section className="pt-[120px] pb-[80px] bg-[#1C1C1E] min-h-screen text-white">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-[#D63384] flex items-center gap-2">
              <FiMapPin className="text-[#D63384]" /> İnteraktif Keşif Haritası
            </h1>
            <p className="text-gray-400 mt-1">
              Yakınınızdaki ve ilgi alanlarınıza uyan diğer kullanıcıları harita üzerinde keşfedin.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 self-start md:self-auto">
            <button
              onClick={triggerBrowserGeolocation}
              className="flex items-center gap-2 py-2 px-4 bg-[#2C2C2E] hover:bg-[#3C3C3E] rounded-xl font-medium transition-colors border border-[#3C3C3E]"
              title="GPS Konumumu Güncelle"
            >
              <FiMapPin className="text-green-500 animate-pulse" /> Konumumu GPS ile Al
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 py-2 px-4 bg-[#2C2C2E] hover:bg-[#3C3C3E] rounded-xl font-medium transition-colors border border-[#3C3C3E]"
            >
              <FiSliders className="text-[#D63384]" /> Filtreleri {showFilters ? "Gizle" : "Göster"}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-[#2C2C2E] border border-[#3C3C3E] rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6 animate-slideDown">
            {/* Distance Filter */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Maksimum Mesafe</span>
                <span className="text-[#D63384] font-semibold">{distance} km</span>
              </div>
              <Slider
                min={0}
                max={distanceOptions.length - 1}
                value={distanceOptions.findIndex(option => option.value === distance)}
                onChange={(index: number) => {
                  const selectedDistance = distanceOptions[index].value;
                  setDistance(selectedDistance);
                }}
                className="mb-2"
                railStyle={{ backgroundColor: '#3C3C3E' }}
                trackStyle={{ backgroundColor: '#D63384' }}
                handleStyle={[
                  { borderColor: '#8A2BE2', backgroundColor: '#8A2BE2' }
                ]}
                marks={distanceOptions.reduce((acc, option, index) => {
                  acc[index] = '';
                  return acc;
                }, {} as Record<number, string>)}
              />
              <div className="grid grid-cols-3 gap-1 mt-2 max-h-[100px] overflow-y-auto pr-1">
                {distanceOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setDistance(option.value)}
                    title={option.label}
                    className={`text-[10px] py-1 px-1.5 rounded text-center truncate ${distance === option.value
                      ? 'bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white'
                      : 'bg-[#3C3C3E] text-gray-300 hover:bg-[#4C4C4E]'
                      } transition-colors`}
                  >
                    {option.value} km
                  </button>
                ))}
              </div>
            </div>

            {/* Age Range Filter */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Yaş Aralığı</span>
                <span className="text-[#D63384] font-semibold">{ageRange[0]} - {ageRange[1]} yaş</span>
              </div>
              <Slider
                range
                min={18}
                max={99}
                value={ageRange}
                onChange={(value: number[]) => setAgeRange(value)}
                className="mb-2"
                railStyle={{ backgroundColor: '#3C3C3E' }}
                trackStyle={[{ backgroundColor: '#D63384' }]}
                handleStyle={[
                  { borderColor: '#8A2BE2', backgroundColor: '#8A2BE2' },
                  { borderColor: '#D63384', backgroundColor: '#D63384' }
                ]}
              />
            </div>

            {/* Fame Range Filter */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span>Popülerlik</span>
                <span className="text-[#D63384] font-semibold">⭐ {fameRating[0]} - {fameRating[1]}</span>
              </div>
              <Slider
                range
                min={0}
                max={5}
                value={fameRating}
                onChange={(value: number[]) => setFameRating(value)}
                className="mb-2"
                railStyle={{ backgroundColor: '#3C3C3E' }}
                trackStyle={[{ backgroundColor: '#D63384' }]}
                handleStyle={[
                  { borderColor: '#8A2BE2', backgroundColor: '#8A2BE2' },
                  { borderColor: '#D63384', backgroundColor: '#D63384' }
                ]}
              />
            </div>

            {/* Tags Filter */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm text-gray-300">
                <span>Etiketler</span>
                {tags.length > 0 && (
                  <button
                    onClick={() => {
                      setTags([]);
                      toast.success('Filtre etiketleri temizlendi');
                    }}
                    className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    Temizle
                  </button>
                )}
              </div>
              <input
                type="text"
                className="w-full bg-[#3C3C3E] border border-[#4C4C4E] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#D63384]"
                placeholder="Etiket ekle (Enter)..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.currentTarget.value.trim().toLowerCase();
                    if (value && !tags.includes(value)) {
                      setTags([...tags, value]);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-[80px] overflow-y-auto pr-1">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center bg-[#3C3C3E] text-white px-2 py-0.5 rounded-full text-[10px]"
                  >
                    #{tag}
                    <button
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                      className="ml-1.5 text-gray-400 hover:text-red-500 transition-colors text-[11px]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Map Container */}
        {!currentUserProfile ? (
          <div className="bg-[#2C2C2E] border border-[#3C3C3E] rounded-2xl p-12 text-center max-w-2xl mx-auto shadow-xl">
            <FiMapPin className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Konum Bilginiz Bulunamadı</h3>
            <p className="text-gray-400 mb-6">
              Haritada çevrenizdeki kullanıcıları görebilmek için profilinizde geçerli bir konuma sahip olmanız gerekmektedir.
            </p>
            <a
              href="/settings"
              className="inline-block py-2.5 px-6 bg-[#D63384] hover:bg-[#E03A90] text-white rounded-xl font-semibold transition-colors"
            >
              Konum Ayarlarına Git
            </a>
          </div>
        ) : (
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-black/40 z-10 rounded-2xl flex items-center justify-center backdrop-blur-[2px]">
                <div className="bg-[#1C1C1E] border border-[#2C2C2E] px-6 py-4 rounded-xl flex items-center gap-3 shadow-2xl">
                  <FiLoader className="w-6 h-6 text-[#D63384] animate-spin" />
                  <span className="font-medium text-gray-200">Kullanıcılar güncelleniyor...</span>
                </div>
              </div>
            )}

            <UsersMap
              users={users}
              currentUserLocation={[currentUserProfile.latitude, currentUserProfile.longitude]}
              onLikeUser={handleLikeUser}
              height="650px"
            />

            {/* Info Summary overlay */}
            <div className="absolute bottom-4 left-4 bg-[#1C1C1E]/90 border border-[#2C2C2E] rounded-xl p-3 z-[999] shadow-lg max-w-[250px] backdrop-blur-md">
              <div className="text-xs text-gray-300 font-medium flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Sen (Buradasın)
              </div>
              <div className="text-xs text-gray-300 font-medium flex items-center gap-2 mt-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Eşleşebileceğin Kişiler
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#2C2C2E] text-xs text-gray-400">
                Haritada <span className="text-[#D63384] font-bold">{users.length}</span> eşleşme adayı gösteriliyor.
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
