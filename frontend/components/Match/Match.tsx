"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FiHeart, FiMapPin, FiStar, FiTag, FiFilter, FiMoreHorizontal } from "react-icons/fi";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Profile {
  id: string;
  name: string;
  age: number;
  image: string;
  fameRating: number;
  distance: number;
  tags: string[];
  location: string;
}
interface SuggestedProfile {
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
  last_online: string;
  pictures: {
    id: number;
    profile_id: string;
    file_path: string;
    backend_url: string;
    is_primary: boolean;
    created_at: string;
  }[];
  tags: {
    id: number;
    name: string;
  }[];
  birth_date: string;
}

interface FilterState {
  min_age: number;
  max_age: number;
  min_fame: number;
  max_fame: number;
  max_distance: number;
  tags: string[];
}

enum SortOption {
  AGE_ASC = 'age_asc',
  AGE_DESC = 'age_desc',
  DISTANCE = 'distance',
  FAME_RATING = 'fame_rating',
  TAGS_MATCH = 'tags_match'
}

const MatchContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const DEFAULT_MIN_AGE = 18;
  const DEFAULT_MAX_AGE = 99;
  const DEFAULT_MIN_FAME = 0;
  const DEFAULT_MAX_FAME = 5;
  const DEFAULT_MAX_DISTANCE = 20000;

  const getInitialFilterValues = () => {
    const minAge = parseInt(searchParams.get("min_age") || DEFAULT_MIN_AGE.toString());
    const maxAge = parseInt(searchParams.get("max_age") || DEFAULT_MAX_AGE.toString());
    const minFame = parseInt(searchParams.get("min_fame") || DEFAULT_MIN_FAME.toString());
    const maxFame = parseInt(searchParams.get("max_fame") || DEFAULT_MAX_FAME.toString());
    const maxDistance = parseInt(searchParams.get("max_distance") || DEFAULT_MAX_DISTANCE.toString());
    const tags = searchParams.getAll("tag");
    
    return {
      minAge: isNaN(minAge) ? DEFAULT_MIN_AGE : minAge,
      maxAge: isNaN(maxAge) ? DEFAULT_MAX_AGE : maxAge,
      minFame: isNaN(minFame) ? DEFAULT_MIN_FAME : minFame,
      maxFame: isNaN(maxFame) ? DEFAULT_MAX_FAME : maxFame,
      maxDistance: isNaN(maxDistance) ? DEFAULT_MAX_DISTANCE : maxDistance,
      tags
    };
  };

  const initialValues = getInitialFilterValues();
  const [isPageVisible, setIsPageVisible] = useState(true);
  const initialLoadRef = useRef(true);
  const visibilityChangeHandledRef = useRef(false);

  const [ageRange, setAgeRange] = useState([DEFAULT_MIN_AGE, DEFAULT_MAX_AGE]);
  const [fameRating, setFameRating] = useState([DEFAULT_MIN_FAME, DEFAULT_MAX_FAME]);
  const [tags, setTags] = useState<string[]>([]);
  const { data: session } = useSession();
  const [profiles, setProfiles] = useState<SuggestedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    min_age: initialValues.minAge,
    max_age: initialValues.maxAge,
    min_fame: initialValues.minFame,
    max_fame: initialValues.maxFame,
    max_distance: initialValues.maxDistance,
    tags: initialValues.tags
  });
  const [likedProfiles, setLikedProfiles] = useState<Set<string>>(new Set());
  const [isLikeLoading, setIsLikeLoading] = useState<string | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(SortOption.DISTANCE);
  const [userProfile, setUserProfile] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loadedProfileIds, setLoadedProfileIds] = useState<Set<string>>(new Set());
  const [isFetchingMore, setIsFetchingMore] = useState(false);

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
  const [distance, setDistance] = useState(DEFAULT_MAX_DISTANCE);

  // Handle filter submit function
  const handleFilterSubmit = () => {
    const newFilters = {
      min_age: ageRange[0],
      max_age: ageRange[1],
      min_fame: fameRating[0],
      max_fame: fameRating[1],
      max_distance: distance,
      tags: tags
    };
    
    setFilters(newFilters);
    setFiltersApplied(true);
    setPage(0);
    setLoadedProfileIds(new Set());
    setProfiles([]);
    setIsLoading(true);
    
    // URL'yi güncelle
    updateUrlWithFilters(newFilters);
    
    // Profilleri yükle
    setTimeout(() => {
      fetchProfiles();
    }, 0);
  };

  useEffect(() => {
    setAgeRange([filters.min_age, filters.max_age]);
  }, []);

  const observer = useRef<IntersectionObserver>();
  // Reference for the last profile element to trigger loading more
  const lastProfileRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      // Load more when user reaches the bottom
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, isFetchingMore]);

  const updateUrlWithFilters = (newFilters: FilterState) => {
    const params = new URLSearchParams();
    
    // Sadece default değerlerden farklı olanları ekle
    if (newFilters.min_age !== DEFAULT_MIN_AGE) params.append("min_age", newFilters.min_age.toString());
    if (newFilters.max_age !== DEFAULT_MAX_AGE) params.append("max_age", newFilters.max_age.toString());
    if (newFilters.min_fame !== DEFAULT_MIN_FAME) params.append("min_fame", newFilters.min_fame.toString());
    if (newFilters.max_fame !== DEFAULT_MAX_FAME) params.append("max_fame", newFilters.max_fame.toString());
    if (newFilters.max_distance !== DEFAULT_MAX_DISTANCE) params.append("max_distance", newFilters.max_distance.toString());
    
    // Sıralama parametresini ekle
    if (sortBy !== SortOption.DISTANCE) params.append("sort", sortBy);
    
    // Etiketleri ekle
    newFilters.tags.forEach(tag => {
      params.append("tag", tag);
    });
    
    // URL'yi güncelle (history'ye ekleyerek)
    const url = params.toString() ? `?${params.toString()}` : '';
    router.push(`/match${url}`, { scroll: false });
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      setIsPageVisible(isVisible);
      
      if (isVisible && !initialLoadRef.current && !visibilityChangeHandledRef.current) {
        // Sadece sekme değişiminden geri dönüşlerde işlem yap
        visibilityChangeHandledRef.current = true;
        setTimeout(() => {
          visibilityChangeHandledRef.current = false;
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Initialize data on first load - immediately fetch profiles
  useEffect(() => {
    const initializeData = async () => {
      if (session?.user?.accessToken) {
        setIsLoading(true);
        initialLoadRef.current = true;
        // Fetch user profile first
        await fetchUserProfile();

        // Reset state for a clean start
        setPage(0);
        setLoadedProfileIds(new Set());
        setProfiles([]);
        await fetchProfiles();
        setIsInitialLoad(false);
        initialLoadRef.current = false;
      }
    };

    // Always initialize on component mount
    initializeData();
  }, [session]);

  useEffect(() => {
    if (!isInitialLoad && filtersApplied) {
      updateUrlWithFilters(filters);
    }
  }, [sortBy]);

  useEffect(() => {
    // Başlangıçta çalıştırma
    if (isInitialLoad) return;
    
    const newValues = getInitialFilterValues();
    const sortParam = searchParams.get("sort");
    
    // Sadece URL'den yüklenen değerleri değiştir
    setAgeRange([newValues.minAge, newValues.maxAge]);
    setFameRating([newValues.minFame, newValues.maxFame]);
    setDistance(newValues.maxDistance);
    setTags(newValues.tags);
    
    // Sıralamayı güncelle
    if (sortParam && Object.values(SortOption).includes(sortParam as SortOption)) {
      setSortBy(sortParam as SortOption);
    }
    
    // Filtreleri güncelle ve verileri yeniden yükle
    setFilters({
      min_age: newValues.minAge,
      max_age: newValues.maxAge,
      min_fame: newValues.minFame,
      max_fame: newValues.maxFame,
      max_distance: newValues.maxDistance,
      tags: newValues.tags
    });
    
    if (!isInitialLoad) {
      setPage(0);
      setLoadedProfileIds(new Set());
      setProfiles([]);
      setIsLoading(true);
      setTimeout(() => {
        fetchProfiles();
      }, 0);
    }
  }, [searchParams]);

  // Handle filter changes
  useEffect(() => {
    // Only respond to filter changes after initial load and when filters change
    if (!isInitialLoad && session?.user?.accessToken && filtersApplied) {
      setIsLoading(true);
      setPage(0); 
      setLoadedProfileIds(new Set());
      setProfiles([]);
      fetchProfiles();
    }
  }, [filters, session, isInitialLoad, filtersApplied]);

  // Handle pagination (fetching more profiles)
  useEffect(() => {
    if (page > 0 && session?.user?.accessToken && !isInitialLoad) {
      setIsFetchingMore(true);
      fetchProfiles();
    }
  }, [page, session, isInitialLoad]);

  // Batch fetch liked status for all profiles
  const fetchLikedStatus = async (profileIds: string[]) => {
    if (!session?.user?.accessToken || profileIds.length === 0) return;

    try {
      // This endpoint would return the liked status for multiple profiles in one request
      // You might need to implement this endpoint on your backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/liked-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ profileIds })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newLikedProfiles = new Set<string>();
        
        // Process the response and update likedProfiles set
        data.likedProfiles.forEach((profileId: string) => {
          newLikedProfiles.add(profileId);
        });
        
        setLikedProfiles(newLikedProfiles);
      }
    } catch (error) {
      console.error('Error fetching liked profiles status:', error);
    }
  };

  // Fallback to individual requests if batch endpoint is not available
  const checkLikedProfilesIndividually = async () => {
    if (!session?.user?.accessToken || profiles.length === 0) return;

    try {
      // Create a map of profile ID to username for easier lookup
      const profileIdToUsername = new Map();
      profiles.forEach(profile => {
        profileIdToUsername.set(profile.id, profile.username);
      });

      // Get unique profile IDs to check
      const uniqueProfileIds = [...new Set(profiles.map(profile => profile.id))];
      const newLikedProfiles = new Set<string>();

      // Make requests in parallel
      const likedStatusPromises = uniqueProfileIds.map(async (profileId) => {
        const username = profileIdToUsername.get(profileId);
        if (!username) return { profileId, isLiked: false };

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/me/is-liked/${username}`,
            {
              headers: {
                'Authorization': `Bearer ${session.user.accessToken}`,
                'Content-Type': 'application/json',
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            return { profileId, isLiked: data.is_liked };
          }
          return { profileId, isLiked: false };
        } catch (error) {
          console.error(`Error checking like status for ${username}:`, error);
          return { profileId, isLiked: false };
        }
      });

      const results = await Promise.all(likedStatusPromises);

      // Update the likedProfiles set
      results.forEach(result => {
        if (result.isLiked) {
          newLikedProfiles.add(result.profileId);
        }
      });

      setLikedProfiles(newLikedProfiles);
    } catch (error) {
      console.error('Error checking liked profiles:', error);
    }
  };

  // Check liked status when profiles change
  useEffect(() => {
    if (profiles.length === 0 || !session?.user?.accessToken) return;
    
    // For now, use the individual checks directly since the batch endpoint might not exist yet
    //checkLikedProfilesIndividually();
    
    // When you implement the batch endpoint, you can use this code instead:
    const newProfileIds = profiles
      .map(profile => profile.id);
      // Try batch API first
    fetchLikedStatus(newProfileIds).catch(() => {
      // Fall back to individual requests if batch fails
      checkLikedProfilesIndividually();
    });
    
  }, [profiles, session]);

  // Fetch user profile information
  const fetchUserProfile = async () => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/me`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch user profile');

      const data = await response.json();
      setUserProfile({
        latitude: data.latitude,
        longitude: data.longitude
      });

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Kullanıcı konumu alınamadı');
    }
  };

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return Math.round(distance);
  };

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m uzaklıkta`;
    } else {
      return `${distance} km uzaklıkta`;
    }
  };

  // Fetch profiles from API
  const fetchProfiles = async () => {
    if (!session?.user?.accessToken) return;
    
    try {
      if (page === 0) {
        setIsLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      const queryParams = new URLSearchParams({
        limit: '10',
        offset: (page * 10).toString(),
      });
  
      // Add filter parameters
      if (page > 0 || filtersApplied) {
        queryParams.append('min_age', filters.min_age.toString());
        queryParams.append('max_age', filters.max_age.toString());
        queryParams.append('min_fame', filters.min_fame.toString());
        queryParams.append('max_fame', filters.max_fame.toString());
        queryParams.append('max_distance', filters.max_distance.toString());
  
        if (filters.tags.length > 0) {
          filters.tags.forEach(tag => {
            queryParams.append('tags', tag);
          });
        }
      }
  
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/suggested?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );
  
      if (!response.ok) {
        const responseText = await response.text();
        console.log("API Error response:", responseText);
        
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map(err => err.msg || JSON.stringify(err)).join(', ');
          } else if (errorData.detail && typeof errorData.detail === 'object') {
            errorMessage = JSON.stringify(errorData.detail);
          } else {
            errorMessage = `Profiller yüklenirken bir hata oluştu: ${response.status}`;
          }
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          errorMessage = `Profiller yüklenirken bir hata oluştu: ${response.status} - ${response.statusText}`;
        }
        
        // Check for specific error cases
        if (errorMessage.includes("profilinizi tamamlayın")) {
          toast.dismiss('profile-incomplete-toast');
          toast.error("Lütfen profilinizi tamamlayın", { 
            id: 'profile-incomplete-toast',
            duration: 5000,
            position: 'top-center'
          });
          
          // Redirect to settings
          setTimeout(() => {
            router.push('/settings');
          }, 500);
          
          return;
        }
        
        throw new Error(errorMessage);
      }
  
      const data = await response.json();

      
  
      // Filter out profiles we've already loaded
      if (document.visibilityState === "visible" && !initialLoadRef.current) {
        setLoadedProfileIds(new Set());
      }

      // Filter out profiles only if it's not a tab switch return
      let uniqueNewProfiles = data;
      if (loadedProfileIds.size > 0) {
        uniqueNewProfiles = data.filter((profile: SuggestedProfile) =>
          !loadedProfileIds.has(profile.id)
        );
      }
  
      if (uniqueNewProfiles.length === 0 && data.length > 0) {
        // Eğer tüm profiller zaten yüklenmişse ve veri boş değilse
        // Filtrelemeyi atla ve doğrudan gelen verileri kullan
        uniqueNewProfiles = data;
        setLoadedProfileIds(new Set());
      }
      
      // Update the set of profile IDs we've loaded
      const updatedProfileIds = new Set(loadedProfileIds);
      uniqueNewProfiles.forEach((profile: SuggestedProfile) => {
        updatedProfileIds.add(profile.id);
      });
      setLoadedProfileIds(updatedProfileIds);
  
      // Update the profiles state
      setProfiles(prev => page === 0 ? uniqueNewProfiles : [...prev, ...uniqueNewProfiles]);
      setHasMore(data.length === 10);
  
    } catch (error) {
      console.error("Profile loading error:", error);
      
      toast.dismiss('profile-loading-error');
      try {
        toast.error(error instanceof Error ? error.message : 'Profiller yüklenirken bir hata oluştu', {
          id: 'profile-loading-error',
          duration: 4000
        });
      } catch (toastError) {
        console.error("Toast error:", toastError);
      }
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  // Calculate age from birth date
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;

    const today = new Date();
    const birth = new Date(birthDate);

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  // Reset filters to defaults
  const resetFilters = () => {
    setFilters({
      min_age: DEFAULT_MIN_AGE,
      max_age: DEFAULT_MAX_AGE,
      min_fame: DEFAULT_MIN_FAME,
      max_fame: DEFAULT_MAX_FAME,
      max_distance: DEFAULT_MAX_DISTANCE,
      tags: []
    });
    setAgeRange([DEFAULT_MIN_AGE, DEFAULT_MAX_AGE]);
    setFameRating([DEFAULT_MIN_FAME, DEFAULT_MAX_FAME]);
    setDistance(DEFAULT_MAX_DISTANCE);
    setTags([]);
    setFiltersApplied(false);
    setPage(0);
    setLoadedProfileIds(new Set());
    setProfiles([]);
    setIsLoading(true);

    router.push('/match', { scroll: false });
    
    // Immediately fetch profiles with default filters
    setTimeout(() => {
      fetchProfiles();
    }, 0);
  };

  // Handle liking/unliking a profile
  const handleLike = async (profileId: string) => {
    if (isLikeLoading === profileId) return;
    setIsLikeLoading(profileId);

    try {
      const isLiked = likedProfiles.has(profileId);
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/like${isLiked ? `/${profileId}` : ''}`;

      const response = await fetch(url, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.accessToken}`,
          'Content-Type': 'application/json',
        },
        ...(isLiked ? {} : { body: JSON.stringify({ liked_id: profileId }) })
      });

      if (!response.ok) throw new Error();

      setLikedProfiles(prev => {
        const newSet = new Set(prev);
        isLiked ? newSet.delete(profileId) : newSet.add(profileId);
        return newSet;
      });

      toast.success(isLiked ? 'Beğeni kaldırıldı' : 'Profil beğenildi');

    } catch (error) {
      toast.error('Bir hata oluştu');
    } finally {
      setIsLikeLoading(null);
    }
  };

  // Sort profiles based on selected sort option
  const sortProfiles = (profiles: SuggestedProfile[]): SuggestedProfile[] => {
    try {

      if (!profiles || profiles.length === 0) { 
        console.log("No profiles to sort");
        return [];
      }
      
      const sortedProfiles = [...profiles];

      switch (sortBy) {
        case SortOption.AGE_ASC:
          return sortedProfiles.sort((a, b) =>
            calculateAge(a.birth_date) - calculateAge(b.birth_date)
          );
        case SortOption.AGE_DESC:
          return sortedProfiles.sort((a, b) =>
            calculateAge(b.birth_date) - calculateAge(a.birth_date)
          );
        case SortOption.DISTANCE:
          if (userProfile) {
            return sortedProfiles.sort((a, b) =>
              calculateDistance(userProfile.latitude, userProfile.longitude, a.latitude, a.longitude) -
              calculateDistance(userProfile.latitude, userProfile.longitude, b.latitude, b.longitude)
            );
          }
          return sortedProfiles;
        case SortOption.FAME_RATING:
          return sortedProfiles.sort((a, b) => b.fame_rating - a.fame_rating);
          case SortOption.TAGS_MATCH:
            return sortedProfiles.sort((a, b) => {
              // Compare how many of the selected filter tags match each profile's tags
              const aTagNames = a.tags.map(tag => tag.name.toLowerCase());
              const bTagNames = b.tags.map(tag => tag.name.toLowerCase());
              const aMatches = tags.filter(tag => aTagNames.includes(tag.toLowerCase())).length;
              const bMatches = tags.filter(tag => bTagNames.includes(tag.toLowerCase())).length;
              
              // Sort by number of matching tags (descending)
              if (bMatches !== aMatches) {
                return bMatches - aMatches;
              }
              
              // If same number of matches, sort by distance as secondary criteria
              if (userProfile) {
                return calculateDistance(userProfile.latitude, userProfile.longitude, a.latitude, a.longitude) -
                      calculateDistance(userProfile.latitude, userProfile.longitude, b.latitude, b.longitude);
              }
              
              return 0;
            });
        default:
          return sortedProfiles;
      }
    }
    catch (error) {
      console.error("Profile sorting error:", error);
      return profiles || []; // Orijinal profilleri veya boş dizi döndür
    }
  };

  return (
    <section className="pt-16 md:pt-20 lg:pt-28 bg-[#1E1E1E]">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap">
          {/* Filter Sidebar - Fixed position on scroll */}
          <div className="w-full lg:w-1/4 mb-8 lg:mb-0">
            <div className="lg:sticky lg:top-24 bg-[#2C2C2E] rounded-xl p-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              <h3 className="text-xl font-semibold text-white mb-6">Filtreler</h3>

              <div className="mb-6">
                <label className="text-gray-300 mb-2 block">Yaş Aralığı</label>
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
                <div className="text-gray-400 text-sm">
                  {ageRange[0]} - {ageRange[1]} yaş
                </div>
              </div>

              <div className="mb-6">
                <label className="text-gray-300 mb-2 block">Popülerlik</label>
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
                <div className="text-gray-400 text-sm">
                  {fameRating[0]} - {fameRating[1]} yıldız
                </div>
              </div>

              <div className="mb-6">
                <label className="text-gray-300 mb-2 block">Mesafe</label>
                <div className="mb-2">
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
                </div>

                <div className="flex justify-between text-gray-400 text-sm">
                  <span>Seçilen mesafe:</span>
                  <span className="font-medium">{distance} km</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3">
                  {distanceOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => setDistance(option.value)}
                      title={option.label}
                      className={`text-xs py-1 px-2 rounded ${distance === option.value
                        ? 'bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white'
                        : 'bg-[#3C3C3E] text-gray-300'
                        } transition-colors`}
                    >
                      {option.value} km
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-gray-300 block">Etiketler</label>
                  {tags.length > 0 && (
                    <button
                      onClick={() => {
                        setTags([]);
                        toast.success('Tüm etiketler temizlendi');
                      }}
                      className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
                    >
                      Hepsini Temizle
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="w-full bg-[#3C3C3E] border-none rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-[#D63384] outline-none"
                  placeholder="Etiket ekle..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value.trim();
                      if (value && !tags.includes(value)) {
                        setTags([...tags, value]);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {tag}
                      <button
                        onClick={() => setTags(tags.filter((_, i) => i !== index))}
                        className="ml-2"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleFilterSubmit}
                className="w-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 hover:scale-[1.02] sticky bottom-4"
              >
                Eşleştir
              </button>
            </div>
          </div>

          {/* Profile Cards Section */}
          <div className="w-full lg:w-3/4 lg:pl-12">
            {/* Sort dropdown */}
            <div className="flex justify-end mb-4">
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-[#2C2C2E] text-white py-2 pl-3 pr-8 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-[#D63384] appearance-none"
                >
                  <option value={SortOption.DISTANCE}>Mesafeye göre</option>
                  <option value={SortOption.AGE_ASC}>Yaş (Küçükten büyüğe)</option>
                  <option value={SortOption.AGE_DESC}>Yaş (Büyükten küçüğe)</option>
                  <option value={SortOption.FAME_RATING}>Popülerliğe göre</option>
                  <option value={SortOption.TAGS_MATCH}>Etiket eşleşmesine göre</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>

            {/* Loading state */}
            {isLoading ? (
              <div className="flex justify-center items-center h-60">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-10 w-10 border-4 border-t-transparent border-[#D63384] rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-300 font-medium">Profiller yükleniyor...</p>
                </div>
              </div>
            ) : (
              <>
                {profiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 text-center p-8 bg-[#2C2C2E] rounded-xl">
                    <div className="text-gray-300 text-xl mb-2">Bu filtrelere uygun profil bulunamadı</div>
                    <div className="text-gray-400 mb-4">Farklı filtre seçeneklerini deneyebilirsiniz</div>
                    <button
                      onClick={resetFilters}
                      className="px-6 py-2 bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Filtreleri Sıfırla
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortProfiles(profiles).map((profile, index) => (
                        <div
                          key={`${profile.id}-${index}`}
                          ref={index === profiles.length - 1 ? lastProfileRef : null}
                          className="bg-[#2C2C2E] rounded-xl overflow-hidden"
                        >
                          <Link href={`/profile/${profile.username}`}>
                            <div className="relative h-48 group">
                              <Image
                                src={profile.pictures.find(p => p.is_primary)?.backend_url || '/images/defaults/profile-default.jpg'}
                                alt={`${profile.first_name}'s profile`}
                                fill
                                priority
                                sizes="100%"
                                className="object-cover"
                                unoptimized
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleLike(profile.id);
                                }}
                                disabled={isLikeLoading === profile.id}
                                className={`absolute top-2 right-2 p-2 rounded-full transition-all
                                  ${likedProfiles.has(profile.id)
                                    ? 'bg-[#D63384] text-white'
                                    : 'bg-white/80 hover:bg-white text-gray-600'
                                  }
                                  ${isLikeLoading === profile.id ? 'opacity-50' : ''}
                                `}
                              >
                                <FiHeart
                                  className={`w-5 h-5 ${likedProfiles.has(profile.id) ? 'fill-white' : ''}`}
                                  style={{ fill: likedProfiles.has(profile.id) ? 'currentColor' : 'none' }}
                                />
                              </button>
                            </div>
                          </Link>
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-xl font-semibold text-white">
                                {profile.first_name}, {calculateAge(profile.birth_date)}
                              </h3>
                              <div className="flex items-center">
                                <FiStar className="w-4 h-4 text-[#D63384]" />
                                <span className="text-gray-300 ml-1">{Math.round(profile.fame_rating)}</span>
                              </div>
                            </div>

                            {/* Biography */}
                            <div className="relative mb-3">
                              <p className="text-gray-300 text-sm line-clamp-2">
                                {profile.biography || "Henüz bir biyografi eklenmemiş."}
                              </p>
                              {profile.biography && profile.biography.length > 100 && (
                                <div className="absolute bottom-0 right-0 bg-gradient-to-l from-[#2C2C2E] to-transparent pl-2 pr-1">
                                  <Link href={`/profile/${profile.username}`}>
                                    <FiMoreHorizontal className="w-4 h-4 text-gray" />
                                  </Link>
                                </div>
                              )}
                            </div>

                            {/* Location */}
                            <div className="flex items-center text-gray-400 text-sm mb-3">
                              <FiMapPin className="w-4 h-4 mr-1" />
                              <span>
                                {userProfile ? (
                                  formatDistance(calculateDistance(
                                    userProfile.latitude,
                                    userProfile.longitude,
                                    profile.latitude,
                                    profile.longitude
                                  ))
                                ) : (
                                  <span className="flex items-center">
                                    <div className="w-3 h-3 mr-1 rounded-full border-2 border-t-0 border-l-0 border-[#D63384] animate-spin"></div>
                                    Konum alınıyor...
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              {profile.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-[#3C3C3E] text-gray-300 px-2 py-1 rounded-full cursor-pointer hover:bg-[#4C4C4E] transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault(); // Prevent navigation to profile page
                                    e.stopPropagation(); // Stop event propagation

                                    // Only add the tag if it's not already in the filters
                                    if (!tags.includes(tag.name)) {
                                      setTags([...tags, tag.name]);
                                      toast.success(`'${tag.name}' etiketi filtrelere eklendi`);
                                    } else {
                                      toast.error(`'${tag.name}' etiketi zaten eklenmiş`);
                                    }
                                  }}
                                >
                                  #{tag.name}
                                </span>
                              ))}
                              {profile.tags.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{profile.tags.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Loading more indicator */}
                    {isFetchingMore && (
                      <div className="flex justify-center mt-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D63384]"></div>
                      </div>
                    )}

                    {/* Sentinel element for infinite scrolling */}
                    {hasMore && !isFetchingMore && (
                      <div className="flex justify-center items-center py-8" ref={lastProfileRef}>
                        <div className="animate-pulse flex flex-col items-center">
                          <div className="h-8 w-8 border-t-2 border-b-2 border-[#D63384] rounded-full animate-spin mb-2"></div>
                          <p className="text-gray-400">Yeni profiller aranıyor...</p>
                        </div>
                      </div>
                    )}

                    {/* No more profiles message */}
                    {!hasMore && !isLoading && !isFetchingMore && (
                      <div className="text-center py-8 text-gray-400">
                        <p className="mb-1">Tüm profiller yüklendi ({profiles.length})</p>
                        <p className="text-sm">Filtreleri değiştirerek daha fazla profil bulabilirsiniz</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// Loading component to show while suspense is active
const LoadingUI = () => {
  return (
    <section className="pt-16 md:pt-20 lg:pt-28 bg-[#1E1E1E] min-h-screen">
      <div className="container mx-auto px-4">
        <div className="flex justify-center items-center h-60">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-10 w-10 border-4 border-t-transparent border-[#D63384] rounded-full animate-spin mb-4"></div>
            <p className="text-gray-300 font-medium">Yükleniyor...</p>
          </div>
        </div>
      </div>
    </section>
  );
};

// Main component that wraps with Suspense
const Match = () => {
  return (
    <Suspense fallback={<LoadingUI />}>
      <MatchContent />
    </Suspense>
  );
};

export default Match;