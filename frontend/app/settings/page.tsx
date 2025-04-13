"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { FiUser, FiLock, FiMapPin, FiBell, FiUserX, FiX, FiPlus } from "react-icons/fi";
import { toast, Toaster } from "react-hot-toast";
import { FiLoader } from "react-icons/fi";
import { SimpleMap } from "@/components/MapSelector/SimpleMap";

interface ProfilePicture {
  id: string;
  file_path: string;
  backend_url: string;
  is_primary: boolean;
}

interface Tag {
  id: string;
  name: string;
}

interface BlockedUser {
  id: string;
  name: string;
  avatar: string;
  blockedDate: string;
}

interface ProfileApiResponse {
  gender: string;
  sexual_preference: string;
  biography: string;
  latitude: number;
  longitude: number;
  id: string;
  user_id: string;
  fame_rating: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  pictures: ProfilePicture[];
  tags: Tag[];
  birth_date: string;
}
interface UserApiResponse {
  email: string;
  username: string;
  is_active: boolean;
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
  is_online: boolean;
  last_online: string;
  is_verified: boolean;
}

interface PublicProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  is_online: boolean;
  pictures: ProfilePicture[];
}

interface ProfileState {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  birthDate: string;
  gender: string;
  preference: string;
  location: string;
  biography: string;
  photos: ProfilePicture[]; // Type is correct, just need to map from pictures
  latitude: number;
  longitude: number;
}



import { Metadata } from "next";

const metadata: Metadata = {
  title: "Ayarlar | CrushIt",
  description: "CrushIt platformunda profilinizi düzenleyin ve diğer kullanıcıları keşfedin."
};

const SettingsPage = () => {
  // Session hook
  const { data: session } = useSession();

  const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <FiLoader className="w-12 h-12 text-[#D63384] animate-spin" />
      <p className="mt-4 text-gray-400">Yükleniyor...</p>
    </div>
  );

  const [showMap, setShowMap] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);


  // Tab state
  const [activeTab, setActiveTab] = useState("account");

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Account deletion states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const passwordInputRef = useRef(null);

  // Tags states
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);

  const BLACKLISTED_TAGS = [
    'admin',
    'moderator',
    'staff',
    'support',
    'system',
    'crushit',
    'crushitapp'
    // Add more blacklisted words as needed
  ];



  // Notification states
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    messageNotifications: true,
    matchNotifications: true,
  });

  // Profile info state
  const [profileInfo, setProfileInfo] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    birthDate: "",
    gender: "",
    preference: "",
    location: "",
    biography: "",
    photos: [],
    latitude: 0,
    longitude: 0
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isOAuth, setIsOAuth] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<PublicProfile[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  const isOAuthUser = async (accessToken: string): Promise<boolean> => {
    try {
      // Get user's OAuth connections
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/users/me/oauth`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );
  
      if (!response.ok) {
        console.error('Failed to check OAuth status');
        return false;
      }
  
      const data = await response.json();
      // Return true if user has any OAuth connections
      return data.has_oauth_connections || false;
    } catch (error) {
      console.error('Error checking OAuth status:', error);
      return false;
    }
  };

  // Add fetch function
  const fetchBlockedUsers = useCallback(async () => {
    setIsLoadingBlocked(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/interactions/blocks?limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch blocked users');
      }

      const data = await response.json();
      setBlockedUsers(data);
    } catch (error) {
      console.error('Blocked users fetch error:', error);
      toast.error('Engellenen kullanıcılar yüklenemedi');
    } finally {
      setIsLoadingBlocked(false);
    }
  }, [session]);

  // Update handleUnblock function
  const handleUnblock = async (userId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/interactions/block/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unblock user');
      }

      toast.success('Kullanıcının engeli kaldırıldı');
      await fetchBlockedUsers(); // Refresh list after unblocking
    } catch (error) {
      console.error('Unblock error:', error);
      toast.error('Kullanıcının engeli kaldırılamadı');
    }
  };

  // Add useEffect to fetch blocked users when tab changes
  useEffect(() => {
    if (activeTab === "blocked" && session?.user?.accessToken) {
      fetchBlockedUsers();
    }
  }, [activeTab, session, fetchBlockedUsers]);

    // Add this function after other imports
    const getCityCountryFromCoords = useCallback(async (latitude: number | null, longitude: number | null): Promise<string> => {
      // Return early if coordinates are null/undefined
      if (!latitude || !longitude) {
        return 'Konum bilgisi yok';
      }
  
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
        );
  
        if (!response.ok) {
          throw new Error('Geocoding failed');
        }
  
        const data = await response.json();
        const city = data.address?.province || data.address?.city || '';
        const country = data.address?.country || '';
  
        return city && country ? `${city}, ${country}` : 'Konum bilgisi bulunamadı';
      } catch (error) {
        console.error('Geocoding error:', error);
        return 'Konum bilgisi alınamadı';
      }
    }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const [profileResponse, userResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me`, {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
            'Content-Type': 'application/json',
          }
        }),
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
            'Content-Type': 'application/json',
          }
        })
      ]);

      if (!profileResponse.ok || !userResponse.ok) {
        throw new Error('Data fetch failed');
      }

      const [profileData, userData]: [ProfileApiResponse, UserApiResponse] = await Promise.all([
        profileResponse.json(),
        userResponse.json()
      ]);

      // Update profile info state with both API responses
      setProfileInfo(prevState => ({
        ...prevState,
        firstName: userData.first_name || "",
        lastName: userData.last_name || "",
        username: userData.username || "",
        email: userData.email || "",
        gender: profileData.gender || "",
        preference: profileData.sexual_preference || "",
        biography: profileData.biography || "",
        latitude: profileData.latitude || 0,
        longitude: profileData.longitude || 0,
        photos: profileData.pictures || [], // Changed from photos to pictures
        tag: profileData.tags.join(", "),
        birthDate: profileData.birth_date ? new Date(profileData.birth_date).toISOString().split('T')[0] : "",
      }));

      setTags(profileData.tags);
      const locationString = profileData.latitude && profileData.longitude ?
        await getCityCountryFromCoords(profileData.latitude, profileData.longitude) :
        'Konum bilgisi yok';

      // Update profileInfo with both coordinates and location string
      setProfileInfo(prev => ({
        ...prev,
        latitude: profileData.latitude || 0,
        longitude: profileData.longitude || 0,
        location: locationString
      }));

    } catch (error) {
      toast.error('Profil bilgileri yüklenemedi');
      console.error('Profile fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, getCityCountryFromCoords]);


  // Effects
  useEffect(() => {
    document.title = metadata.title as string;
  }, []);

  useEffect(() => {
    if (session?.user?.accessToken) {
      fetchProfile();
      
      // Check if user is an OAuth user
      const checkOAuthStatus = async () => {
        const oauthStatus = await isOAuthUser(session.user.accessToken);
        setIsOAuth(oauthStatus);
      };
      
      checkOAuthStatus();
    }
  }, [session, fetchProfile]);

  // Modified account deletion modal for OAuth users
  const renderDeleteAccountModal = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-[#2C2C2E] p-6 rounded-lg max-w-md w-full mx-4">
          <h3 className="text-xl font-semibold text-white mb-4">Hesap Silme Onayı</h3>
          
          {isOAuth ? (
            <>
              <p className="text-gray-400 mb-4">
                42 hesabıyla giriş yaptığınız için şifre doğrulamasına gerek yok. Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  className="px-4 py-2 bg-[#3C3C3E] text-white rounded-lg hover:bg-[#4C4C4E]"
                  onClick={() => setShowDeleteModal(false)}
                >
                  İptal
                </button>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  onClick={handleOAuthAccountDelete}
                >
                  Hesabı Sil
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-400 mb-4">
                Hesabınızı silmek için lütfen şifrenizi girin. Bu işlem geri alınamaz.
              </p>
              <div className="space-y-4">
                <input
                  type="password"
                  ref={passwordInputRef}
                  value={deletePassword}
                  onChange={handleDeletePasswordChange}
                  placeholder="Şifrenizi girin"
                  className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                />
                <div className="flex justify-end space-x-3">
                  <button
                    className="px-4 py-2 bg-[#3C3C3E] text-white rounded-lg hover:bg-[#4C4C4E]"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletePassword("");
                    }}
                  >
                    İptal
                  </button>
                  <button
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    onClick={handleDeleteAccount}
                  >
                    Hesabı Sil
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Add this function for OAuth account deletion
  const handleOAuthAccountDelete = async () => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/delete-oauth-account`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Hesap silme işlemi başarısız');
      }

      // Account successfully deleted, logout user
      toast.success('Hesabınız başarıyla silindi');
      setShowDeleteModal(false);

      // Redirect to home page after short delay
      setTimeout(() => {
        signOut({ callbackUrl: '/' });
      }, 2000);

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hesap silme işlemi başarısız');
      console.error('Account deletion error:', error);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Tüm alanları doldurunuz");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifreler eşleşmiyor");
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.user?.accessToken}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Şifre değiştirme başarısız');
      }

      toast.success('Şifre başarıyla değiştirildi');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || !session?.user?.accessToken) {
      toast.error("Lütfen şifrenizi girin");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/delete-account`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: deletePassword
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Hesap silme işlemi başarısız');
      }

      // Hesap başarıyla silindi, kullanıcıyı logout yap
      toast.success('Hesabınız başarıyla silindi');
      setShowDeleteModal(false);
      setDeletePassword("");

      // Redirect to home page after short delay
      setTimeout(() => {
        signOut({ callbackUrl: '/' });
      }, 2000);

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hesap silme işlemi başarısız');
      console.error('Account deletion error:', error);
    }
  };

  // Update modal input handler
  const handleDeletePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeletePassword(e.target.value);
  };



  const isValidTag = (tag: string): boolean => {
    const normalizedTag = tag.toLowerCase().trim();

    // Check against blacklist
    if (BLACKLISTED_TAGS.includes(normalizedTag)) {
      toast.error('Bu etiket kullanılamaz');
      return false;
    }

    // Check length
    if (normalizedTag.length < 2 || normalizedTag.length > 20) {
      toast.error('Etiket 2-20 karakter uzunluğunda olmalıdır');
      return false;
    }

    // Check if already exists
    if (tags.some(tag => tag.name === normalizedTag)) {
      toast.error('Bu etiket zaten eklenmiş');
      return false;
    }

    // Only allow letters, numbers and dashes
    if (!/^[a-zçğüöış0-9-]+$/.test(normalizedTag)) {
      toast.error('Etiket sadece harf, rakam ve tire içerebilir');
      return false;
    }

    return true;
  };

  // Add tag handler
  const handleTagKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const tagName = tagInput.toLowerCase().trim();

      if (!tagName) return;

      if (!isValidTag(tagName)) {
        setTagInput('');
        return;
      }

      try {
        const newTag: Tag = {
          id: crypto.randomUUID(),
          name: tagName
        };

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/tags`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
          body: JSON.stringify({
            tags: [...tags.map(tag => tag.name), tagName] // Send only tag names
          })
        });

        const data = await response.json();

        if (!response.ok) {
          // Check if response has validation error details
          if (data.detail && Array.isArray(data.detail)) {
            // Show the first validation error message
            toast.error(data.detail[0].msg || 'Etiket eklenirken bir hata oluştu');
          } else {
            throw new Error('Failed to add tag');
          }
          return;
        }

        setTags(prev => [...prev, newTag]);
        setTagInput('');
        toast.success('Etiket başarıyla eklendi');

      } catch (error) {
        toast.error('Etiket eklenirken bir hata oluştu');
        console.error('Tag adding error:', error);
      }
    }
  };

  // Add tag removal handler
  const handleRemoveTag = async (tagName: string) => {
    try {
      const updatedTags = tags.filter(tag => tag.name !== tagName);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.user?.accessToken}`,
        },
        body: JSON.stringify({
          tags: updatedTags.map(tag => tag.name)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.detail && Array.isArray(data.detail)) {
          toast.error(data.detail[0].msg || 'Etiket kaldırılırken bir hata oluştu');
        } else {
          throw new Error('Failed to remove tag');
        }
        return;
      }

      setTags(updatedTags);
      toast.success('Etiket başarıyla kaldırıldı');

    } catch (error) {
      toast.error('Etiket kaldırılırken bir hata oluştu');
      console.error('Tag removal error:', error);
    }
  };



  const handleSetPrimaryPhoto = async (pictureId: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/pictures/${pictureId}/primary`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to set primary photo');
      }

      // Refresh profile to get updated photos
      await fetchProfile();
      toast.success('Ana fotoğraf başarıyla güncellendi');

    } catch (error) {
      toast.error('Ana fotoğraf güncellenirken bir hata oluştu');
      console.error('Primary photo update error:', error);
    } finally {
      setIsLoading(false);
    }
  };


  // Update handleLocationDetect function
  const handleLocationDetect = async () => {
    setIsLoading(true);

    const updateLocationInfo = async (latitude: number, longitude: number) => {
      setIsLoading(true);

      const updateLocationViaAPI = async (latitude: number, longitude: number) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/location`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ latitude, longitude })
        });

        if (!response.ok) {
          throw new Error('Location update failed');
        }

        setProfileInfo(prev => ({
          ...prev,
          latitude,
          longitude
        }));
      };

      try {
        // Update coordinates via API
        await updateLocationViaAPI(latitude, longitude);

        // Get city and country
        const locationString = await getCityCountryFromCoords(latitude, longitude);

        // Update profileInfo with both coordinates and location string
        setProfileInfo(prev => ({
          ...prev,
          latitude,
          longitude,
          location: locationString
        }));

        toast.success('Konum başarıyla güncellendi');
      } catch (error) {
        throw error;
      }
    };

    try {
      // Browser geolocation
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, (error) => {
              if (error.code === error.PERMISSION_DENIED) {
                reject(new Error('PERMISSION_DENIED'));
              } else {
                reject(error);
              }
            });
          });

          await updateLocationInfo(pos.coords.latitude, pos.coords.longitude);
          return;
        } catch (geoError) {
        }
      }

      // IP Geolocation fallback
      try {
        const ipResponse = await fetch('https://ipapi.co/json/');
        if (!ipResponse.ok) throw new Error('IP geolocation failed');

        const ipData = await ipResponse.json();

        if (!ipData.latitude || !ipData.longitude) {
          throw new Error('Invalid location data from IP');
        }

        await updateLocationInfo(ipData.latitude, ipData.longitude);
      } catch (ipError) {
        throw new Error('IP üzerinden konum alınamadı');
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Konum güncellenirken bir hata oluştu');
      console.error('Location update error:', error);
    } finally {
      setIsLoading(false);
    }
  };



  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show loading state
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_primary', (!profileInfo.photos.length).toString()); // First photo is primary

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/pictures`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.user?.accessToken}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Fotoğraf yüklenirken bir hata oluştu');
      }

      // Refresh profile to get updated photos
      await fetchProfile();
      toast.success('Fotoğraf başarıyla yüklendi');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fotoğraf yüklenirken bir hata oluştu';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoRemove = async (pictureId: string) => {
    if (!confirm('Bu fotoğrafı silmek istediğinize emin misiniz?')) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/pictures/${pictureId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      // Refresh profile to get updated photos
      await fetchProfile();
      toast.success('Fotoğraf başarıyla silindi');

    } catch (error) {
      toast.error('Fotoğraf silinirken bir hata oluştu');
      console.error('Photo delete error:', error);
    } finally {
      setIsLoading(false);
    }
  };



    const handleProfileUpdate = async () => {
      try {
        // Update user data first
        const userResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/users/me`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            first_name: profileInfo.firstName,
            last_name: profileInfo.lastName,
            username: profileInfo.username,
            email: profileInfo.email,
          })
        });
  
        if (!userResponse.ok) {
          const userError = await userResponse.json();
          if (userError.detail) {
            // Handle nested object error format like {"detail":{"username":"Username can only contain letters and numbers"}}
            if (typeof userError.detail === 'object' && !Array.isArray(userError.detail)) {
              const errorMessage = Object.entries(userError.detail)
                .map(([field, message]) => `${message}`)
                .join(', ');
              throw new Error(errorMessage);
            }
            // Handle array format
            else if (Array.isArray(userError.detail)) {
              throw new Error(userError.detail[0].msg);
            }
            // Handle string format
            else {
              throw new Error(userError.detail);
            }
          }
          throw new Error('Kullanıcı bilgileri güncellenemedi');
        }
  
        // Format birth_date to ISO string
        let formattedBirthDate = null;
        if (profileInfo.birthDate) {
          const date = new Date(profileInfo.birthDate);
          formattedBirthDate = new Date(Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0, 0, 0
          )).toISOString();
        }
  
        // Then update profile data
        const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gender: profileInfo.gender,
            sexual_preference: profileInfo.preference,
            biography: profileInfo.biography,
            latitude: profileInfo.latitude,
            longitude: profileInfo.longitude,
            birth_date: formattedBirthDate
          })
        });
  
        if (!profileResponse.ok) {
          const profileError = await profileResponse.json();
          if (profileError.detail) {
            // Handle nested object error format
            if (typeof profileError.detail === 'object' && !Array.isArray(profileError.detail)) {
              const errorMessage = Object.entries(profileError.detail)
                .map(([field, message]) => `${message}`)
                .join(', ');
              throw new Error(errorMessage);
            }
            // Handle array format
            else if (Array.isArray(profileError.detail)) {
              throw new Error(profileError.detail[0].msg);
            }
            // Handle string format
            else {
              throw new Error(profileError.detail);
            }
          }
          throw new Error('Profil güncellenemedi');
        }
  
        toast.success('Profil başarıyla güncellendi');
        await fetchProfile();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Profil güncellenirken bir hata oluştu');
        console.error('Profile update error:', error);
      }
    };

  const handleManualLocationSelect = async () => {
    if (!selectedPosition) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profiles/me/location`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${session?.user?.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: selectedPosition[0],
          longitude: selectedPosition[1],
        }),
      });

      if (!response.ok) throw new Error("Location update failed");

      setProfileInfo((prev) => ({
        ...prev,
        latitude: selectedPosition[0],
        longitude: selectedPosition[1],
        location: `${selectedPosition[0].toFixed(4)}, ${selectedPosition[1].toFixed(4)}`,
      }));

      setShowMap(false);
      toast.success("Konum başarıyla güncellendi");
    } catch (error) {
      console.error("Konum güncelleme hatası:", error);
    }
  };



  // Update TabButton definition
  const TabButton = ({ value, icon: Icon, label }: { value: string; icon: any; label: string }) => (
    <button
      onClick={() => {
        setActiveTab(value);
        if (value === "account") {
          fetchProfile();
        }
      }}
      className={`w-full flex items-center space-x-2 p-3 text-left rounded-lg transition-colors ${activeTab === value
        ? "bg-[#3C3C3E] text-white"
        : "text-gray-400 hover:bg-[#3C3C3E] hover:text-white"
        }`}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );

  return (
    <section className="pt-[150px] pb-[120px] bg-[#1C1C1E] min-h-screen">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Ayarlar</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8">
          {/* Sidebar - existing code */}
          <div className="bg-[#2C2C2E] rounded-xl p-4 space-y-2">
            <TabButton value="account" icon={FiUser} label="Hesap Ayarları" />
            <TabButton value="privacy" icon={FiLock} label="Gizlilik" />
{/*             <TabButton value="notifications" icon={FiBell} label="Bildirimler" /> */}
            <TabButton value="blocked" icon={FiUserX} label="Engellenen Kullanıcılar" />
          </div>
          {/* Content */}
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="bg-[#2C2C2E] rounded-xl p-8">

              {activeTab === "account" && (

                <div>

                  <h2 className="text-2xl font-semibold text-white mb-6">Hesap Ayarları</h2>
                  <div className="space-y-8">
                    {/* Profile Photos */}
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-4">Profil Fotoğrafları</h3>
                      <div className="grid grid-cols-5 gap-4">
                        {[...Array(5)].map((_, index) => (
                          <div key={index} className="aspect-square rounded-lg bg-[#3C3C3E] overflow-hidden relative">
                            {profileInfo.photos[index] ? (
                              <>
                                <Image
                                  src={profileInfo.photos[index].backend_url}
                                  alt={`Photo ${index + 1}`}
                                  fill
                                  priority
                                  sizes="%100"
                                  className="object-cover"
                                  unoptimized
                                />
                                <div className="absolute top-2 left-2 flex space-x-2">
                                  {profileInfo.photos[index].is_primary ? (
                                    <span className="bg-[#D63384] text-white text-xs px-2 py-1 rounded-full">
                                      Ana Fotoğraf
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleSetPrimaryPhoto(profileInfo.photos[index].id)}
                                      className="bg-[#3C3C3E] text-white text-xs px-2 py-1 rounded-full hover:bg-[#4C4C4E]"
                                    >
                                      Ana Fotoğraf Yap
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handlePhotoRemove(profileInfo.photos[index].id)}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <FiX className="text-white" />
                                </button>
                              </>
                            ) : (
                              <label className="flex items-center justify-center h-full cursor-pointer hover:bg-[#4C4C4E] transition-colors">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload(e, index)}
                                />
                                <FiPlus className="text-gray-400 w-8 h-8" />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Basic Info */}
                    <h3 className="text-2xl font-semibold text-white mb-6">Profil Bilgileri</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-300 mb-2">İsim</label>
                        <input
                          type="text"
                          value={profileInfo.firstName}
                          onChange={(e) => setProfileInfo({ ...profileInfo, firstName: e.target.value })}
                          placeholder="İsminiz"
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">Soyisim</label>
                        <input
                          value={profileInfo.lastName}
                          onChange={(e) => setProfileInfo({ ...profileInfo, lastName: e.target.value })}
                          placeholder="Soyisminiz"
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">Kullanıcı Adı</label>
                        <input
                          value={profileInfo.username}
                          onChange={(e) => setProfileInfo({ ...profileInfo, username: e.target.value })}
                          placeholder="Kullanıcı adınız"
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">E-posta</label>
                        <input
                          type="email"
                          value={profileInfo.email}
                          onChange={(e) => setProfileInfo({ ...profileInfo, email: e.target.value })}
                          placeholder="E-posta adresiniz"
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                          disabled={isOAuth}
                        />
                        {isOAuth && (
                          <p className="text-sm text-gray-400 mt-2">
                            42 hesabıyla giriş yaptığınız için e-posta adresinizi değiştiremezsiniz.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Personal Info */}
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-gray-300 mb-2">Doğum Tarihi</label>
                        <input
                          type="date"
                          value={profileInfo.birthDate}
                          onChange={(e) => setProfileInfo({ ...profileInfo, birthDate: e.target.value })}
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-300 mb-2">Cinsiyet</label>
                        <select
                          value={profileInfo.gender}
                          onChange={(e) => setProfileInfo({ ...profileInfo, gender: e.target.value })}
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2"
                        >
                          <option value="">Seçiniz</option>
                          <option value="male">Erkek</option>
                          <option value="female">Kadın</option>
                          <option value="non_binary">Non-binary</option>
                          <option value="other">Diğer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-2">Cinsiyet Tercihi</label>
                        <select
                          value={profileInfo.preference}
                          onChange={(e) => setProfileInfo({ ...profileInfo, preference: e.target.value })}
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2"
                        >
                          <option value="">Seçiniz</option>
                          <option value="heterosexual">Heteroseksüel</option>
                          <option value="homosexual">Homoseksüel</option>
                          <option value="bisexual">Biseksüel</option>
                          <option value="other">Diğer</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2">Biyografi</label>
                      <textarea
                        value={profileInfo.biography}
                        onChange={(e) => setProfileInfo({ ...profileInfo, biography: e.target.value })}
                        className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 min-h-[100px]"
                        placeholder="Kendinizden bahsedin..."
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleProfileUpdate}
                        className="bg-[#D63384] text-white py-2 px-4 rounded-lg hover:bg-[#D63384] transition-colors"
                      >Değişiklikleri Kaydet</button>
                    </div>


                    {/* Tags */}
                    <hr className="border-[#3C3C3E]" />
                    <h3 className="text-xl font-semibold text-white mb-4">Etiketler</h3>
                    <div>
                      <label className="block text-gray-300 mb-2">Etiketler</label>
                      <div className="space-y-2">
                        <input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          placeholder="Etiket eklemek için yazın ve Enter'a basın"
                          className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {tags.map(tag => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center bg-[#3C3C3E] text-white px-3 py-1 rounded-full text-sm"
                            >
                              #{tag.name}
                              <button
                                onClick={() => handleRemoveTag(tag.name)}
                                className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <FiX className="w-4 h-4" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2">Konum</label>
                      <div className="flex space-x-2">
                        <input
                          value={profileInfo.location}
                          readOnly
                          placeholder="Şehir, Ülke"
                          className="flex-1 bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                        />
                        <button
                          onClick={handleLocationDetect}
                          className="bg-[#3C3C3E] text-white px-4 py-2 rounded-lg hover:bg-[#4C4C4E] transition-colors flex items-center space-x-2"
                        >
                          <FiMapPin />
                          <span>Konumu Algıla</span>
                        </button>
                        <button
                          onClick={() => setShowMap(!showMap)}
                          className="bg-[#3C3C3E] text-white px-4 py-2 rounded-lg hover:bg-[#4C4C4E] transition-colors flex items-center space-x-2"
                        >
                          <FiMapPin />
                          <span>Haritadan Seç</span>
                        </button>
                      </div>

                      {showMap && (
                        <div className="mt-4">
                          <SimpleMap
                            initialLocation={
                              profileInfo.latitude && profileInfo.longitude 
                                ? [profileInfo.latitude, profileInfo.longitude] 
                                : undefined
                            }
                            onLocationSelect={(lat, lng) => {
                              // Burada koordinatları doğru formatta ayarlıyoruz
                              const position: [number, number] = [lat, lng];
                              setSelectedPosition(position);
                            }}
                          />
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => setShowMap(false)}
                              className="mr-2 bg-gray-600 text-white px-4 py-2 rounded-lg"
                            >
                              İptal
                            </button>
                            <button
                              onClick={handleManualLocationSelect}
                              disabled={!selectedPosition}
                              className={`bg-[#D63384] text-white px-4 py-2 rounded-lg ${
                                !selectedPosition ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              Konumu Güncelle
                            </button>
                          </div>
                          
                        
                        </div>
                      )}

                      <div className="flex justify-end mt-4">
                        <p className="text-gray-400 text-sm">
                          Latitude: {profileInfo.latitude.toFixed(4)}, Longitude: {profileInfo.longitude.toFixed(4)}
                        </p>
                        </div>
                    </div>



                  </div>
                </div>

              )}

              {/* Privacy Tab */}
              {activeTab === "privacy" && (
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-6">Gizlilik</h2>
                  <div className="space-y-8">
              {/* Password Change Section */}
              <div className="border-b border-[#3C3C3E] pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Şifre Değiştir</h3>
                
                {isOAuth ? (
                  <div className="p-4 bg-[#3C3C3E] rounded-lg">
                    <p className="text-gray-300">
                      42 hesabıyla giriş yaptığınız için şifre değiştirme özelliği kullanılamaz.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Mevcut Şifre</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Mevcut şifrenizi girin"
                        className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2">Yeni Şifre</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Yeni şifrenizi girin"
                        className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2">Yeni Şifre (Tekrar)</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Yeni şifrenizi tekrar girin"
                        className="w-full bg-[#3C3C3E] text-white rounded-lg px-4 py-2 border border-[#4C4C4E] focus:outline-none focus:border-[#D63384]"
                      />
                    </div>
                    <div className="flex justify-start space-x-3">
                      <button
                        className="bg-[#D63384] text-white py-2 px-4 rounded-lg hover:bg-[#D63384] transition-colors"
                        onClick={handlePasswordChange}
                        type="button"
                      >
                        Şifreyi Değiştir
                      </button>
                    </div>
                  </div>
                )}
              </div>

                    {/* Account Deletion Section */}
                    <div>
                      <h3 className="text-xl font-semibold text-red-500 mb-4">Hesap Silme</h3>
                      <p className="text-gray-400 mb-4">
                        Hesabınızı silmek geri alınamaz bir işlemdir. Tüm verileriniz kalıcı olarak silinecektir.
                      </p>
                      <button
                        className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        Hesabımı Sil
                      </button>
                    </div>
                  </div>

                  {/* Delete Account Modal */}
                  {showDeleteModal && renderDeleteAccountModal()}
                </div>
              )}
              {/* Notifications Tab */}
{/*               {activeTab === "notifications" && (
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-6">Bildirimler</h2>
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-4">E-posta Bildirimleri</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Yeni bir mesaj aldığımda</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={notifications.emailNotifications}
                            onClick={() => setNotifications(prev => ({ ...prev, emailNotifications: !prev.emailNotifications }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications.emailNotifications ? "bg-[#D63384]" : "bg-[#3C3C3E]"
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications.emailNotifications ? "translate-x-6" : "translate-x-1"
                                }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Yeni bir eşleşme olduğunda</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={notifications.matchNotifications}
                            onClick={() => setNotifications(prev => ({ ...prev, matchNotifications: !prev.matchNotifications }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications.matchNotifications ? "bg-[#D63384]" : "bg-[#3C3C3E]"
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications.matchNotifications ? "translate-x-6" : "translate-x-1"
                                }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )} */}

              {/* Blocked Users Tab */}
              {activeTab === "blocked" && (
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-6">Engellenen Kullanıcılar</h2>
                  {isLoadingBlocked ? (
                    <LoadingSpinner />
                  ) : blockedUsers.length > 0 ? (
                    <div className="space-y-8">
                      {blockedUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 relative overflow-hidden rounded-full">
                              <Image
                                src={user.pictures.find(p => p.is_primary)?.backend_url || '/images/defaults/man-default.png'}
                                alt={`${user.first_name}'s profile picture`}
                                fill
                                sizes="%100"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                            <span className="text-white">{user.first_name} {user.last_name}</span>
                          </div>
                          <button
                            className="bg-[#D63384] text-white py-2 px-4 rounded-lg hover:bg-[#D63384] transition-colors"
                            onClick={() => handleUnblock(user.id)}
                          >
                            Engeli Kaldır
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <p>Engellediğiniz kullanıcı bulunmamaktadır.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </section>
  );
};

export default SettingsPage;