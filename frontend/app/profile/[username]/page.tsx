"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FiHeart, FiMessageSquare, FiMapPin, FiClock, FiStar, FiSlash, FiFlag, FiEdit, FiMoreHorizontal, FiLoader } from "react-icons/fi";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Metadata } from "next";
import LoadingSpinner from "@/components/LoadingSpinner";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  FaMars, // Male
  FaVenus, // Female
  FaGenderless, // Non-binary
  FaQuestion, // Other
  FaVenusMars, // Heterosexual
  FaMarsDouble, // Gay
  FaVenusDouble, // Lesbian
  FaTransgender // Bisexual
} from 'react-icons/fa';

const metadata: Metadata = {
  title: "Profil | CrushIt",
  description: "CrushIt platformunda profilinizi düzenleyin ve diğer kullanıcıları keşfedin."
};

interface PublicProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  is_online: boolean;
  pictures: ProfilePicture[];
}

interface ProfilePicture {
  id: number;
  profile_id: string;
  file_path: string;
  backend_url: string;
  is_primary: boolean;
  created_at: string;
}

interface CurrentUserProfile {
  id: string;
  latitude: number;
  longitude: number;
}

// Update interface for block status
interface BlockInfo {
  is_blocked: boolean;
  block_info: null | {
    block_date: string;
    blocker_id: string;
    blocked_id: string;
  };
}

interface BlockStatus {
  is_blocked: boolean | BlockInfo;
  blocked_by_me: boolean | BlockInfo;
  blocked_by_them: boolean | BlockInfo;
  blocker_id: string | null;
}



interface Tag {
  id: number;
  name: string;
}

interface ProfileData {
  isMatched: any;
  recentVisitors: any;
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
  is_online: boolean;
  last_online: string | null;
  pictures: ProfilePicture[];
  tags: Tag[];
  birth_date: string;
}

const ProfilePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const { data: session } = useSession();
  const params = useParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showFullBio, setShowFullBio] = useState(false);
  const BIO_LIMIT = 150;
  const [recentVisitors, setRecentVisitors] = useState<PublicProfile[]>([]);
  const [recentLikers, setRecentLikers] = useState<PublicProfile[]>([]);
  const [recentMatches, setRecentMatches] = useState<PublicProfile[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isLoadingLikers, setIsLoadingLikers] = useState(false);
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    is_blocked: { is_blocked: false, block_info: null },
    blocked_by_me: { is_blocked: false, block_info: null },
    blocked_by_them: { is_blocked: false, block_info: null },
    blocker_id: null
  });
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  

  useEffect(() => {
    document.title = metadata.title as string;
  }
    , []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/${params.username}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error('Profile fetch error:', error);
      toast.error('Profil bilgileri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  // Move the original useEffect below the function definition
  useEffect(() => {
    if (session?.user?.accessToken) {
      fetchProfile();
    }
  }, [session, params.username]);

  const handleLike = async () => {
    if (!session?.user?.accessToken || !profile) return;

    try {
      const endpoint = isLiked
        ? `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/like/${profile.id}`
        : `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/like`;

      const response = await fetch(endpoint, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: isLiked ? undefined : JSON.stringify({
          liked_id: profile.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process like');
      }

      const data = await response.json();
      setIsLiked(!isLiked);

      if (data.is_match && !isLiked) {
        toast.success('Eşleşme gerçekleşti! 🎉');
      }
    } catch (error) {
      console.error('Like error:', error);
      toast.error(isLiked ? 'Beğeni geri çekilemedi' : 'Profil beğenilemedi');
    }
  };

  const handleBlock = () => {
    if (isBlocked) {
      // Show confirmation before unblocking
      if (window.confirm('Bu kullanıcının engelini kaldırmak istediğinizden emin misiniz?')) {
        confirmBlock();
      }
    } else {
      // Show block modal for blocking
      setShowBlockModal(true);
    }
  };

  const isBlockedCheck = () => {
    console.log(blockStatus);
    
    if (!blockStatus) return false;
    
    // Doğrudan boolean değer veya BlockInfo objesi olabilir
    const isBlocked = typeof blockStatus.is_blocked === 'boolean' 
      ? blockStatus.is_blocked 
      : blockStatus.is_blocked?.is_blocked;
      
    const blockedByMe = typeof blockStatus.blocked_by_me === 'boolean'
      ? blockStatus.blocked_by_me
      : blockStatus.blocked_by_me?.is_blocked;
      
    const blockedByThem = typeof blockStatus.blocked_by_them === 'boolean'
      ? blockStatus.blocked_by_them
      : blockStatus.blocked_by_them?.is_blocked;
    
    return !!(isBlocked || blockedByMe || blockedByThem);
  };

  const confirmBlock = async () => {
    if (!session?.user?.accessToken || !profile) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/block`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocked_id: profile.id
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to process block');
      }

      // Update block statuses with proper BlockInfo structure
      setIsBlocked(true);
      setBlockStatus(prev => ({
        ...prev,
        is_blocked: {
          is_blocked: true,
          block_info: null
        },
        blocked_by_me: {
          is_blocked: true,
          block_info: null
        },
        blocked_by_them: prev.blocked_by_them,
        blocker_id: null
      }));

      setShowBlockModal(false);
      toast.success('Kullanıcı engellendi');

    } catch (error) {
      console.error('Block error:', error);
      toast.error('Kullanıcı engellenemedi');
    }
  };

  const confirmUnBlock = async () => {
    if (!session?.user?.accessToken || !profile) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/block/${profile.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to process unblock');
      }

      // Update block statuses
      setIsBlocked(false);
      setBlockStatus({
        is_blocked: {
          is_blocked: false,
          block_info: null
        },
        blocked_by_me: {
          is_blocked: false,
          block_info: null
        },
        blocked_by_them: {
          is_blocked: false,
          block_info: null
        },
        blocker_id: null
      });

      setShowBlockModal(false);
      toast.success('Engel kaldırıldı');

      // Refresh profile data and block status
      await Promise.all([
        fetchProfile(),
        // Block durumunu kontrol et
        fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/block/status/${profile.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`,
            }
          }
        ).then(res => res.json())
        .then(data => {
          setBlockStatus(data);
          setIsBlocked(data.is_blocked?.is_blocked || data.blocked_by_me?.is_blocked);
        })
      ]);

    } catch (error) {
      console.error('Block error:', error);
      toast.error('Engel kaldırılamadı');
    }
  };

  const renderBlockedView = () => {
    // Doğrudan boolean değer veya BlockInfo objesi olabilir
    const blockedByMe = typeof blockStatus.blocked_by_me === 'boolean'
      ? blockStatus.blocked_by_me
      : blockStatus.blocked_by_me?.is_blocked;
      
    const blockedByThem = typeof blockStatus.blocked_by_them === 'boolean'
      ? blockStatus.blocked_by_them
      : blockStatus.blocked_by_them?.is_blocked;
  
    if (blockedByMe) {
      return (
        <div className="container mx-auto px-4 text-center">
          <div className="bg-[#2C2C2E] rounded-xl p-8">
            <FiSlash className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Bu Kullanıcıyı Engellediniz</h2>
            <p className="text-gray-300 mb-6">
              Bu kullanıcıyı engellediğiniz için profilini görüntüleyemezsiniz.
            </p>
            <button
              onClick={confirmUnBlock}
              className="px-6 py-3 bg-[#D63384] text-white rounded-lg hover:bg-[#B52B6F]"
            >
              Engeli Kaldır
            </button>
          </div>
        </div>
      );
    } else if (blockedByThem) {
      return (
        <div className="container mx-auto px-4 text-center">
          <div className="bg-[#2C2C2E] rounded-xl p-8">
            <FiSlash className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Bu Kullanıcı Sizi Engelledi</h2>
            <p className="text-gray-300 mb-6">
              Bu kullanıcı sizi engellediği için profilini görüntüleyemezsiniz.
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleReport = () => {
    // Show the report modal
    setShowReportModal(true);
  };

  // Report functionality
  const submitReport = async () => {
    if (!session?.user?.accessToken || !profile) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reported_id: profile.id,
            reason: reportReason,
            description: reportDescription
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      setShowReportModal(false);
      setReportReason("");
      setReportDescription("");
      toast.success('Rapor başarıyla gönderildi');
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Rapor gönderilemedi');
    }
  };

  const fetchRecentLikers = async () => {
    if (!session?.user?.accessToken) return;

    setIsLoadingLikers(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/likes?limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch likers');
      }

      const data = await response.json();
      setRecentLikers(data);
    } catch (error) {
      console.error('Recent likers fetch error:', error);
      toast.error('Beğenenler yüklenemedi');
    } finally {
      setIsLoadingLikers(false);
    }
  };

  const fetchCurrentUsername = async () => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (response.ok) {
        const userData = await response.json();
        setCurrentUsername(userData.username);
      }
    } catch (error) {
      console.error('Failed to fetch current user info:', error);
    }
  };

  useEffect(() => {
    if (session?.user?.accessToken) {
      fetchCurrentUsername();
    }
  }, [session]);


  const fetchRecentVisitors = async () => {
    if (!session?.user?.accessToken || !currentUsername || profile?.username !== currentUsername) return;

    setIsLoadingVisitors(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/visits?username=${currentUsername}&limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch visitors');
      }

      const data = await response.json();
      setRecentVisitors(data);
    } catch (error) {
      console.error('Recent visitors fetch error:', error);
      toast.error('Ziyaretçiler yüklenemedi');
    } finally {
      setIsLoadingVisitors(false);
    }
  };

  const fetchRecentMatches = async () => {
    if (!session?.user?.accessToken || !currentUsername || profile?.username !== currentUsername) return;

    setIsLoadingMatches(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/matches?limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }

      const data = await response.json();
      setRecentMatches(data);
    } catch (error) {
      console.error('Recent matches fetch error:', error);
      toast.error('Eşleşmeler yüklenemedi');
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // 4. useEffect'i güncelleyelim
  useEffect(() => {
    if (profile && session?.user?.accessToken && currentUsername) {
      // Sadece kendi profilinde son ziyaretçileri, beğenenleri ve eşleşmeleri göster
      if (profile.username === currentUsername) {
        fetchRecentVisitors();
        fetchRecentLikers();
        fetchRecentMatches();
      }
    }
  }, [profile, session, currentUsername]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c); // Distance in KM, rounded to nearest integer
  };

  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (session?.user?.accessToken && params.username !== 'me') {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/me`,
            {
              headers: {
                'Authorization': `Bearer ${session.user.accessToken}`,
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            setCurrentUserProfile(data);
          }
        } catch (error) {
          console.error('Current user profile fetch error:', error);
        }
      }
    };

    fetchCurrentUserProfile();
  }, [session, params.username]);

  const getPreferenceText = (preference: string): string => {
    const preferences = {
      'heterosexual': 'Heteroseksüel',
      'homosexual': 'Homoseksüel',
      'bisexual': 'Biseksüel',
      'other': 'Diğer'
    };
    return preferences[preference as keyof typeof preferences] || preference;
  };

  const getPreferenceIcon = (preference: string) => {
    const icons = {
      'heterosexual': <FaVenusMars className="text-pink-400" />,
      'homosexual': <FaMarsDouble className="text-blue-400" />,
      'bisexual': <FaTransgender className="text-purple-400" />,
      'other': <FaQuestion className="text-gray-400" />
    };
    return icons[preference as keyof typeof icons] || <FaQuestion className="text-gray-400" />;
  };

  const getGenderIcon = (gender: string) => {
    const icons = {
      'male': <FaMars className="text-blue-400" />,
      'female': <FaVenus className="text-pink-400" />,
      'non_binary': <FaGenderless className="text-purple-400" />,
      'other': <FaQuestion className="text-gray-400" />
    };
    return icons[gender as keyof typeof icons] || <FaQuestion className="text-gray-400" />;
  };

  const getGenderText = (gender: string): string => {
    const genders = {
      'male': 'Erkek',
      'female': 'Kadın',
      'non_binary': 'Non-binary',
      'other': 'Diğer'
    };
    return genders[gender as keyof typeof genders] || gender;
  };

  const getAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const sliderSettings = {
    dots: profile?.pictures?.length > 1,
    infinite: profile?.pictures?.length > 1,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    beforeChange: (current: number, next: number) => setCurrentSlide(next),
    arrows: profile?.pictures?.length > 1
  };

  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!session?.user?.accessToken || !params.username) return;

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/is_blocked?blocked_username=${params.username}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`,
            }
          }
        );

        if (!response.ok) throw new Error('Failed to check block status');
        const data = await response.json();
        setBlockStatus(data);
      } catch (error) {
        console.error('Block status check error:', error);
      }
    };

    checkBlockStatus();
  }, [session, params.username]);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!session?.user?.accessToken || !profile) return;

      try {
        // `/me/is-liked/{username}` endpoint'ini kullanarak beğeni durumunu kontrol edelim
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/me/is-liked/${profile.username}`,
          {
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`,
              'Content-Type': 'application/json',
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setIsLiked(data.is_liked);
        }
      } catch (error) {
        console.error('Failed to check like status:', error);
      }
    };

    checkLikeStatus();
  }, [session, profile]);


  return (
    <section className="pt-[150px] pb-[120px] bg-[#1C1C1E]">
      {isLoading ? (
        <LoadingSpinner />
      ) : isBlockedCheck() ? (
        renderBlockedView()
      ) : profile ? (
        <div className="container mx-auto px-4">
          {/* Profile Header */}
          <div className="relative mb-8">
            <div className="relative h-64 rounded-t-3xl overflow-hidden">
              <Image
                src={profile.pictures[1]?.backend_url || '/images/defaults/man-default.png'}
                alt="Cover"
                fill
                priority
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
            <div className="absolute -bottom-16 left-8">
              <div className="w-32 h-32 rounded-full border-4 border-[#2C2C2E] overflow-hidden relative">
                <Image
                  src={profile.pictures.find(p => p.is_primary)?.backend_url || '/images/defaults/man-default.png'}
                  alt="Avatar"
                  fill
                  sizes="100%"
                  className="object-cover"
                  unoptimized
                />
                <div className={`absolute bottom-4 right-4 w-6 h-6 rounded-full border-2 border-[#2C2C2E] ${profile.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
              </div>
            </div>
          </div>






          {/* Profile Info */}
          <div className="bg-[#2C2C2E] rounded-xl p-8 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {profile.first_name} {profile.last_name}, {getAge(profile.birth_date)}
                </h1>
                <div className="flex items-center text-gray-300">
                  <FiMapPin className="mr-2 text-[#D63384]" />
                  {profile.id === currentUserProfile?.id ? (
                    <span className="text-[#D63384] font-medium">Bu senin profilin</span>
                  ) : currentUserProfile && profile ? (
                    `${calculateDistance(
                      currentUserProfile.latitude,
                      currentUserProfile.longitude,
                      profile.latitude,
                      profile.longitude
                    )} km uzakta`
                  ) : (
                    'Konum bilgisi yüklenemedi'
                  )}
                </div>
              </div>
              <div className="flex space-x-4">
                {profile.id === currentUserProfile?.id ? (
                  <Link href="/settings">
                    <button className="px-6 py-3 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white flex items-center space-x-2 hover:opacity-90">
                      <FiEdit className="w-5 h-5" />
                      <span>Profili Düzenle</span>
                    </button>
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={handleLike}
                      className={`p-3 rounded-full transition-all duration-300 ${isLiked
                        ? 'bg-[#D63384] hover:bg-[#B52B6F] shadow-lg shadow-pink-500/30 scale-105'
                        : 'bg-gradient-to-r from-[#8A2BE2] to-[#D63384] hover:opacity-90 text-white opacity-80'
                        } text-white`}
                      title={isLiked ? "Beğeniyi Kaldır" : "Beğen"}
                    >
                      <FiHeart
                        className={`w-6 h-6 transition-transform ${isLiked
                          ? 'fill-white transform scale-110 animate-pulse'
                          : 'stroke-white'
                          }`}
                      />
                    </button>

                    <button
                      onClick={handleBlock}
                      className={`p-3 rounded-full ${isBlocked
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-[#3C3C3E] hover:bg-[#4C4C4E]'
                        } text-white`}
                    >
                      <FiSlash className="w-6 h-6" />
                    </button>


                    <button
                      onClick={handleReport}
                      className="p-3 rounded-full bg-[#3C3C3E] text-red-500 hover:bg-[#4C4C4E]"
                    >
                      <FiFlag className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center mb-6">
              {[...Array(5)].map((_, index) => (
                <FiStar
                  key={index}
                  className={`w-6 h-6 ${index < profile.fame_rating
                    ? "text-[#D63384]"
                    : "text-gray-600"
                    }`}
                />
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Hakkında</h2>
                <div className="relative">
                  {profile.biography ? (
                    <>
                      <p className="text-gray-300">
                        {showFullBio || profile.biography.length <= BIO_LIMIT
                          ? profile.biography
                          : `${profile.biography.slice(0, BIO_LIMIT)}...`}
                      </p>
                      {profile.biography.length > BIO_LIMIT && !showFullBio && (
                        <button
                          onClick={() => setShowFullBio(true)}
                          className="mt-2 text-[#D63384] hover:text-[#8A2BE2] transition-colors duration-200"
                        >
                          Devamını Gör
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400 italic">Henüz bir biyografi eklenmemiş</p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white mb-2">İlgi Alanları</h2>
                <div className="flex flex-wrap gap-2">
                  {(showAllTags ? profile.tags : profile.tags.slice(0, 10)).map((tag) => (
                    <span
                      key={tag.id}
                      className="px-3 py-1 rounded-full bg-[#3C3C3E] text-gray-300"
                    >
                      #{tag.name}
                    </span>
                  ))}
                  {profile.tags.length > 10 && !showAllTags && (
                    <button
                      onClick={() => setShowAllTags(true)}
                      className="px-3 py-1 rounded-full bg-[#3C3C3E] text-gray-300 hover:bg-[#4C4C4E] transition-colors duration-200 flex items-center space-x-1"
                    >
                      <FiMoreHorizontal className="w-4 h-4" />
                      <span className="text-sm">+{profile.tags.length - 10}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-gray-400 mb-1">Cinsiyet</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">
                      {getGenderIcon(profile.gender)}
                    </span>
                    <p className="text-white">{getGenderText(profile.gender)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-gray-400 mb-1">Tercih</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">
                      {getPreferenceIcon(profile.sexual_preference)}
                    </span>
                    <p className="text-white">{getPreferenceText(profile.sexual_preference)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <FiClock className={`mr-2 ${profile.is_online ? 'text-green-500' : 'text-gray-500'}`} />
                <span className={`${profile.is_online
                  ? 'text-green-500 font-medium'
                  : 'text-gray-400'
                  }`}>
                  {profile.is_online
                    ? "Çevrimiçi"
                    : profile.last_online
                      ? `Son görülme: ${new Date(profile.last_online).toLocaleString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`
                      : "Son görülme: Bilinmiyor"
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Photo Gallery */}
          <div className="bg-[#2C2C2E] rounded-xl p-8 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Fotoğraflar</h2>
            {profile.pictures && profile.pictures.length > 0 ? (
              <div className="h-[500px]">
                {profile.pictures.length === 1 ? (
                  <div className="px-2 h-[450px]">
                    <div
                      className="relative w-full h-full rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => {
                        setCurrentSlide(0);
                        setShowLightbox(true);
                      }}
                    >
                      <Image
                        src={profile.pictures[0].backend_url}
                        alt={`${profile.first_name}'in fotoğrafı`}
                        fill
                        className="object-cover"
                        priority
                        onError={(e) => {
                          e.currentTarget.src = '/images/defaults/man-default.png';
                        }}
                        unoptimized
                      />
                      {profile.pictures[0].is_primary && (
                        <div className="absolute top-2 right-2 bg-[#D63384] text-white text-xs px-2 py-1 rounded-full">
                          Ana Fotoğraf
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <Slider {...sliderSettings}>
                    {profile.pictures.map((picture, index) => (
                      <div key={picture.id} className="px-2 h-[450px]">
                        <div
                          className="relative w-full h-full rounded-xl overflow-hidden cursor-pointer"
                          onClick={() => {
                            setCurrentSlide(index);
                            setShowLightbox(true);
                          }}
                        >
                          <Image
                            src={picture.backend_url}
                            alt={`${profile.first_name}'in ${index + 1}. fotoğrafı`}
                            fill
                            className="object-cover"
                            priority={index === 0}
                            onError={(e) => {
                              e.currentTarget.src = '/images/defaults/man-default.png';
                            }}
                            unoptimized
                          />
                          {picture.is_primary && (
                            <div className="absolute top-2 right-2 bg-[#D63384] text-white text-xs px-2 py-1 rounded-full">
                              Ana Fotoğraf
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </Slider>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <p>Henüz fotoğraf yüklenmemiş</p>
                {profile.id === currentUserProfile?.id && (
                  <p className="text-sm mt-1">Profiline fotoğraf ekleyerek daha fazla etkileşim alabilirsin</p>
                )}
              </div>
            )}
          </div>

          {/* Lightbox */}
          {showLightbox && profile.pictures[currentSlide] && (
            <div
              className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
              onClick={() => setShowLightbox(false)}
            >
              <h3 className="text-white text-xl font-semibold mb-4">
                {profile.first_name} {profile.last_name}
                {profile.pictures[currentSlide].is_primary &&
                  <span className="ml-2 text-sm bg-[#D63384] px-2 py-1 rounded-full">
                    Ana Fotoğraf
                  </span>
                }
              </h3>
              <Image
                src={profile.pictures[currentSlide].backend_url}
                alt={`${profile.first_name}'in tam boy fotoğrafı`}
                width={500}
                height={500}
                style={{ width: "100%", height: "auto" }}
                className="max-w-full max-h-[90vh] object-contain"
                priority
                unoptimized
              />
            </div>
          )}


          {profile?.username === currentUsername && (
            <>
              {/* Recent Visitors */}
              <div className="bg-[#2C2C2E] rounded-xl p-8 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Son Ziyaretçiler
                </h2>
                {isLoadingVisitors ? (
                  <div className="flex items-center justify-center h-12">
                    <FiLoader className="w-6 h-6 text-[#D63384] animate-spin" />
                  </div>
                ) : recentVisitors.length > 0 ? (
                  <div className="flex space-x-4">
                    {recentVisitors
                      .filter((visitor, index, self) =>
                        index === self.findIndex(v => v.id === visitor.id)
                      )
                      .map((visitor) => (
                        <Link
                          href={`/profile/${visitor.username}`}
                          key={`visitor-${visitor.id}`}
                          className="group relative"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden relative">
                            <Image
                              src={
                                Array.isArray(visitor.pictures) && visitor.pictures.length > 0
                                  ? visitor.pictures.find(p => p.is_primary)?.backend_url || visitor.pictures[0]?.backend_url
                                  : '/images/defaults/man-default.png'
                              }
                              alt={`${visitor.first_name}'in profil fotoğrafı`}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/images/defaults/man-default.png';
                              }}
                              unoptimized
                            />
                            {visitor.is_online && (
                              <div className="absolute bottom-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2C2C2E]" />
                            )}
                          </div>
                          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-[#3C3C3E] text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {visitor.first_name}
                          </div>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                    <p>Henüz hiç ziyaretçin olmamış</p>
                    <p className="text-sm mt-1">Profilini güncel tutarak daha fazla etkileşim alabilirsin</p>
                  </div>
                )}
              </div>

              {/* Recent Likers */}
              <div className="bg-[#2C2C2E] rounded-xl p-8 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Son Beğenenler
                </h2>
                {isLoadingLikers ? (
                  <div className="flex items-center justify-center h-12">
                    <FiLoader className="w-6 h-6 text-[#D63384] animate-spin" />
                  </div>
                ) : recentLikers.length > 0 ? (
                  <div className="flex space-x-4">
                    {recentLikers
                      .filter((liker, index, self) =>
                        index === self.findIndex(l => l.id === liker.id)
                      )
                      .map((liker) => (
                        <Link
                          href={`/profile/${liker.username}`}
                          key={`liker-${liker.id}`}
                          className="group relative"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden relative">
                            <Image
                              src={
                                Array.isArray(liker.pictures) && liker.pictures.length > 0
                                  ? liker.pictures.find(p => p.is_primary)?.backend_url || liker.pictures[0]?.backend_url
                                  : '/images/defaults/man-default.png'
                              }
                              alt={`${liker.first_name}'in profil fotoğrafı`}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/images/defaults/man-default.png';
                              }}
                              unoptimized
                            />
                            {liker.is_online && (
                              <div className="absolute bottom-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2C2C2E]" />
                            )}
                          </div>
                          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-[#3C3C3E] text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {liker.first_name}
                          </div>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                    <p>Henüz hiç beğenen olmamış</p>
                    <p className="text-sm mt-1">Profilini güncel tutarak daha fazla etkileşim alabilirsin</p>
                  </div>
                )}
              </div>

              {/* Recent Matches */}
              <div className="bg-[#2C2C2E] rounded-xl p-8 mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Son Eşleşmeler
                </h2>
                {isLoadingMatches ? (
                  <div className="flex items-center justify-center h-12">
                    <FiLoader className="w-6 h-6 text-[#D63384] animate-spin" />
                  </div>
                ) : recentMatches && recentMatches.length > 0 ? (
                  <div className="flex space-x-4">
                    {recentMatches
                      .filter((match, index, self) =>
                        index === self.findIndex(m => m.id === match.id)
                      )
                      .map((match) => (
                        <Link
                          href={`/profile/${match.username}`}
                          key={`match-${match.id}`}
                          className="group relative"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden relative">
                            <Image
                              src={
                                Array.isArray(match.pictures) && match.pictures.length > 0
                                  ? match.pictures.find(p => p.is_primary)?.backend_url || match.pictures[0]?.backend_url
                                  : '/images/defaults/man-default.png'
                              }
                              alt={`${match.first_name}'in profil fotoğrafı`}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/images/defaults/man-default.png';
                              }}
                              unoptimized
                            />
                            {match.is_online && (
                              <div className="absolute bottom-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2C2C2E]" />
                            )}
                          </div>
                          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-[#3C3C3E] text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {match.first_name}
                          </div>
                        </Link>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                    <p>Henüz hiç eşleşmen olmamış</p>
                    <p className="text-sm mt-1">Profilini güncel tutarak daha fazla etkileşim alabilirsin</p>
                  </div>
                )}
              </div>

            </>
          )}

        </div>
      ) : (
        <div className="text-center text-white">
          Profil bulunamadı
        </div>
      )}
      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2C2C2E] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl text-white font-semibold mb-4">Kullanıcıyı Engelle</h3>
            <p className="text-gray-300 mb-6">
              Bu kullanıcıyı engellemek istediğinizden emin misiniz? Engellediğiniz kullanıcılar sizinle iletişim kuramaz.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                İptal
              </button>
              <button
                onClick={confirmBlock}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Engelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2C2C2E] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl text-white font-semibold mb-4">Kullanıcıyı Raporla</h3>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Raporlama Nedeni</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2"
              >
                <option value="">Seçiniz</option>
                <option value="spam">Spam</option>
                <option value="harassment">Taciz</option>
                <option value="inappropriate">Uygunsuz İçerik</option>
                <option value="fake">Sahte Profil</option>
                <option value="other">Diğer</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Açıklama</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 min-h-[100px]"
                placeholder="Lütfen detaylı açıklama yapınız..."
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                  setReportDescription("");
                }}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                İptal
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason || !reportDescription}
                className="px-4 py-2 bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Raporla
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProfilePage;