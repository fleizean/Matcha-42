"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { IoIosSettings } from "react-icons/io";
import ThemeToggler from "./ThemeToggler";
import menuData from "./menuData";
import { FaUserCircle, FaSignOutAlt, FaComment, FaBell, FaHeart, FaKissWinkHeart, FaEye, FaHeartBroken } from "react-icons/fa";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface NotificationType {
  id: number;
  type: "like" | "unlike" | "match" | "unmatch" | "visit" | "message";
  message: string;
  time: string;
  sender_id?: string;
  sender_username?: string;
  read: boolean;
  content?: string;
}

interface UserData {
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

const Header = () => {
  const router = useRouter();
  const [navbarOpen, setNavbarOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [openIndex, setOpenIndex] = useState(-1);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notificationsPage, setNotificationsPage] = useState(0);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);

  // 2. useSession hook
  const { data: session, status } = useSession();

  // 3. usePathname hook
  const pathname = usePathname();
  const usePathName = pathname === "/" ? "/home" : pathname;

  // 5. useEffect hook
  useEffect(() => {
    window.addEventListener("scroll", handleStickyNavbar);
    return () => {
      window.removeEventListener("scroll", handleStickyNavbar);
    };
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.user?.accessToken) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/users/me`, {
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`,
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUserData(data);
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
        }
      }
    };

    fetchUserData();
  }, [session]);


  // 4. Event handlers
  const navbarToggleHandler = () => {
    setNavbarOpen(!navbarOpen);
  };

  const handleStickyNavbar = () => {
    setSticky(window.scrollY >= 80);
  };

  const handleSubmenu = (index: number) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  const fetchNotifications = async () => {
    if (!session?.user?.accessToken) return;

    try {
      setIsLoadingNotifications(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/notifications?limit=10&offset=${notificationsPage * 10}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const formattedNotifications = data.map((notification: any) => {
          let message = "";
          switch (notification.type) {
            case "like":
              message = "Profilinizi beğendi";
              break;
            case "match":
              message = "Bir eşleşmeniz var!";
              break;
            case "message":
              message = "Size yeni bir mesaj gönderdi";
              break;
            case "visit":
              message = "Profilinizi ziyaret etti";
              break;
            default:
              message = "Yeni bir bildirim";
          }
        
          return {
            id: notification.id,
            type: notification.type,
            message,
            time: notification.created_at,
            read: notification.is_read,
            sender_id: notification.sender_id,
            sender_username: notification.sender_username
          };
        });

        // İlk sayfa ise notifications'ı sıfırla, değilse ekle
        if (notificationsPage === 0) {
          setNotifications(formattedNotifications);
        } else {
          setNotifications(prev => [...prev, ...formattedNotifications]);
        }

        // Daha fazla bildirim var mı kontrol et
        setHasMoreNotifications(data.length === 10);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // 3. Daha fazla bildirim yüklemek için yeni bir fonksiyon ekleyelim
  const fetchMoreNotifications = async () => {
    if (isLoadingMoreNotifications || !hasMoreNotifications) return;

    try {
      setIsLoadingMoreNotifications(true);
      const nextPage = notificationsPage + 1;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/notifications?limit=10&offset=${nextPage * 10}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const formattedNotifications = data.map((notification: any) => {
          let message = "";
          switch (notification.type) {
            case "like":
              message = "Profilinizi beğendi";
              break;
            case "match":
              message = "Bir eşleşmeniz var!";
              break;
            case "message":
              message = "Size yeni bir mesaj gönderdi";
              break;
            case "visit":
              message = "Profilinizi ziyaret etti";
              break;
            default:
              message = "Yeni bir bildirim";
          }

          return {
            id: notification.id,
            type: notification.type,
            message,
            time: new Date(notification.created_at).toLocaleString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit'
            }),
            read: notification.is_read,
            sender_id: notification.sender_id
          };
        });

        // Mevcut bildirimlere ekle
        setNotifications(prev => [...prev, ...formattedNotifications]);

        // Sayfa sayısını güncelle
        setNotificationsPage(nextPage);

        // Daha fazla bildirim var mı kontrol et
        setHasMoreNotifications(data.length === 10);
      }
    } catch (error) {
      console.error('Failed to fetch more notifications:', error);
    } finally {
      setIsLoadingMoreNotifications(false);
    }
  };

  // Function to fetch unread notification count
  const fetchNotificationCount = useCallback(async () => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/notifications/count`, {
        headers: {
          'Authorization': `Bearer ${session.user.accessToken}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  }, [session]);

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: number) => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/notifications/${notificationId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        fetchNotificationCount();
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/notifications/read-all`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setNotificationCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: NotificationType) => {
    markNotificationAsRead(notification.id);
  
    // Navigate based on notification type
    switch (notification.type) {
      case "like":
        // Navigate to the profile of the user who liked you
        if (notification.sender_username) {
          router.push(`/profile/${notification.sender_username}`);
        }
        break;
      case "unlike":
        // Navigate to the profile of the user who liked you
        if (notification.sender_username) {
          router.push(`/profile/${notification.sender_username}`);
        }
        break;
      case "match":
        // Navigate to chat with the matched user
        if (notification.sender_id) {
          router.push(`/chat?user=${notification.sender_id}`);
        }
        break;
      case "message":
        // Navigate to chat with the message sender
        if (notification.sender_id) {
          router.push(`/chat?user=${notification.sender_id}`);
        }
        break;
      case "visit":
        // Navigate to the profile of the visitor
        if (notification.sender_username) {
          router.push(`/profile/${notification.sender_username}`);
        }
        break;
      case "unmatch":
        // Just indicate the unmatch but there's nowhere specific to navigate
        // Show toast notification with more info
        toast.custom(`${notification.message}`);
        router.push('/match'); // Redirect to match to refresh the matching view
        break;
      default:
        // For unknown notification types, navigate to match
        router.push('/match');
        break;
    }
  };

  const formatNotificationMessage = (notification: NotificationType): string => {
    switch (notification.type) {
      case "like":
        return notification.sender_username 
          ? `${notification.sender_username} profilinizi beğendi`
          : "Profiliniz beğenildi";

      case "unlike":
        return notification.sender_username 
          ? `${notification.sender_username} profilinizi beğenmekten vazgeçti`
          : "Birisi profilinizi beğenmekten vazgeçti";
      case "match":
        return notification.sender_username 
          ? `${notification.sender_username} ile eşleştiniz! Şimdi sohbet edebilirsiniz.`
          : "Yeni bir eşleşmeniz var!";
      case "message":
        return notification.sender_username 
          ? `${notification.sender_username} size yeni bir mesaj gönderdi`
          : "Yeni bir mesajınız var";
      case "visit":
        return notification.sender_username 
          ? `${notification.sender_username} profilinizi ziyaret etti`
          : "Birisi profilinizi ziyaret etti";
      case "unmatch":
        return notification.sender_username
          ? `${notification.sender_username} artık eşleşmeleriniz arasında değil`
          : "Bir eşleşmeniz sona erdi";
      default:
        return notification.message || "Yeni bir bildiriminiz var";
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      if (!timestamp) return "";
      
      // İlk olarak zaten formatlanmış mı kontrol et
      if (/^\d{1,2}\/\d{1,2}\s\d{1,2}:\d{1,2}$/.test(timestamp)) {
        return timestamp; // Zaten formatlanmışsa doğrudan döndür
      }
      
      let utcDate: Date;
      
      // Backend formatındaki postgresSQL timestamp+timezone formatı (2025-03-31 00:54:09.981732+03)
      if (timestamp.includes(' ') && timestamp.match(/\+\d{2}$/)) {
        // Backend formatı
        const parts = timestamp.split(' ');
        const datePart = parts[0];
        const timePart = parts[1].split('.')[0]; // Microseconds'ı kaldır
        
        // Zaman dilimi bilgisi çıkar ve daha sonra bunu hesaplamada kullan
        const tzOffset = parseInt(timestamp.slice(-2));
        
        // ISO benzeri bir string oluştur
        const isoString = `${datePart}T${timePart}`;
        utcDate = new Date(isoString);
        
        // Zaman dilimi offsetini düzelt
        utcDate.setHours(utcDate.getHours() - tzOffset);
      } else {
        // Frontend formatı ISO string (2025-03-30T21:54:09.981732+00:00)
        utcDate = new Date(timestamp);
      }
      
      // Geçerli bir tarih mi kontrol et
      if (isNaN(utcDate.getTime())) {
        console.error('Invalid date format:', timestamp);
        return timestamp; // Geçersiz tarih ise orijinalini döndür
      }
      
      // Şimdiki zamanı al
      const now = new Date();
      
      // Zaman farkını hesapla
      const diffMs = now.getTime() - utcDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      // Kullanıcı dostu zaman formatı için
      if (diffMins < 1) {
        return "Az önce";
      } else if (diffMins < 60) {
        return `${diffMins} dakika önce`;
      } else if (diffHours < 24) {
        return `${diffHours} saat önce`;
      } else if (diffDays < 7) {
        return `${diffDays} gün önce`;
      } else {
        // Daha eski bildirimler için Türkçe tarih formatı (gün ay saat:dakika)
        const day = utcDate.getDate();
        const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
        const month = monthNames[utcDate.getMonth()];
        const hours = utcDate.getHours();
        const minutes = utcDate.getMinutes();
        
        // İki haneli saat ve dakika formatı
        const formattedHours = hours < 10 ? `0${hours}` : hours;
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        
        return `${day} ${month} ${formattedHours}:${formattedMinutes}`;
      }
    } catch (error) {
      console.error('Timestamp format error:', error, 'for timestamp:', timestamp);
      return timestamp || ""; // Hata durumunda orijinal değeri döndür
    }
  };

  // Get notification icon based on type
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like':
      return <FaHeart className="text-pink-500" />;
    case 'unlike':
      return <FaHeartBroken className="text-red-500" />;
    case 'match':
      return <FaKissWinkHeart className="text-pink-500" />;
    case 'visit':
      return <FaEye className="text-blue-400" />;
    case 'message':
      return <FaComment className="text-green-400" />;
    case 'unmatch':
      return <FaHeartBroken className="text-red-400" />;
    default:
      return <FaBell className="text-gray-400" />;
  }
};

  // Function to toggle notification panel
  const toggleNotifications = () => {
    if (!showNotifications) {
      setNotificationsPage(0);
      fetchNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const handleNotificationsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Listenin sonuna yaklaşıldığında yeni bildirimler yükle
    if (scrollTop + clientHeight >= scrollHeight - 50 && hasMoreNotifications && !isLoadingMoreNotifications) {
      fetchMoreNotifications();
    }
  };

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch notification count on initial load
  useEffect(() => {
    if (session?.user?.accessToken) {
      fetchNotificationCount();

      // Set up polling for notification count (every 30 seconds)
      const intervalId = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(intervalId);
    }
  }, [session, fetchNotificationCount]);

  // Add notification bell to mobile menu
  const toggleMobileNotifications = () => {
    if (!showMobileNotifications) {
      setNotificationsPage(0);
      fetchNotifications();
    }
    setShowMobileNotifications(!showMobileNotifications);
  };
  

  // Mobil görünümde bildirim butonuna tıklandığında çağrılacak fonksiyon
  const handleMobileNotificationClick = () => {
    toggleMobileNotifications();
    // Navbar'ı kapat (opsiyonel)
    // setNavbarOpen(false);
  };
  
  // Render fonksiyonunun en sonuna, return ifadesinin hemen öncesinde mobil bildirimler modalını ekleyin
  const renderMobileNotificationsModal = () => {
    if (!showMobileNotifications) return null;
    
    return (
      <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-[#2C2C2E] w-full max-w-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#3C3C3E] flex justify-between items-center">
            <h3 className="text-white font-medium">Bildirimler</h3>
            <div className="flex items-center space-x-4">
              {notificationCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-sm text-pink-400 hover:text-pink-300"
                >
                  Tümünü okundu işaretle
                </button>
              )}
              <button 
                onClick={() => setShowMobileNotifications(false)}
                className="text-white text-xl"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div
            className="max-h-[70vh] overflow-y-auto"
            onScroll={handleNotificationsScroll}
          >
            {isLoadingNotifications && notificationsPage === 0 ? (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-pink-500"></div>
              </div>
            ) : notifications.length > 0 ? (
              <ul>
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`p-3 border-b border-[#3C3C3E] hover:bg-[#3C3C3E] cursor-pointer ${!notification.read ? 'bg-[#3C3C3E]/50' : ''}`}
                    onClick={() => {
                      handleNotificationClick(notification);
                      setShowMobileNotifications(false);
                    }}
                  >
                    <div className="flex items-start">
                      <div className="mr-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white">
                          {notification.content || formatNotificationMessage(notification)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimestamp(notification.time)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-[#D63384] flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </li>
                ))}
                
                {/* Daha fazla bildirim yükleniyor göstergesi */}
                {isLoadingMoreNotifications && (
                  <li className="p-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-pink-500"></div>
                  </li>
                )}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-400">
                <p>Bildirim bulunmamaktadır</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (status === "loading") {
    return null;
  }

  return (
    <>
      <div className="pt-[120px] lg:pt-0 bg-white dark:bg-dark">
        <header
          className={`header left-0 top-0 z-40 flex w-full items-center mb-[72px] lg:mb-0 ${sticky
            ? "dark:bg-gray-dark dark:shadow-sticky-dark fixed z-[9999] bg-white !bg-opacity-80 shadow-sticky backdrop-blur-sm transition"
            : "absolute bg-transparent"
            }`}
        >
          <div className="container">
            <div className="relative -mx-4 flex items-center justify-between">
              <div className="w-60 max-w-full px-4 xl:mr-12">
                <Link
                  href={session ? "/match" : "/"}
                  className={`header-logo block w-full ${sticky ? "py-5 lg:py-2" : "py-8"
                    } `}
                >
                  <Image
                    src="/images/logo/logo.svg"
                    alt="logo"
                    priority
                    width={230}
                    height={50}
                    className="w-full dark:hidden"
                  />
                  <Image
                    src="/images/logo/logo.svg"
                    alt="logo"
                    priority
                    width={230}
                    height={50}
                    className="hidden w-full dark:block"
                  />
                </Link>
              </div>
              <div className="flex w-full items-center justify-between px-4">
                <div>
                  <button
                    onClick={navbarToggleHandler}
                    id="navbarToggler"
                    aria-label="Mobile Menu"
                    className="absolute right-4 top-1/2 block translate-y-[-50%] rounded-lg px-3 py-[6px] ring-primary focus:ring-2 lg:hidden"
                  >
                    <span
                      className={`relative my-1.5 block h-0.5 w-[30px] bg-black transition-all duration-300 dark:bg-white ${navbarOpen ? " top-[7px] rotate-45" : ""
                        }`}
                    />
                    <span
                      className={`relative my-1.5 block h-0.5 w-[30px] bg-black transition-all duration-300 dark:bg-white ${navbarOpen ? "opacity-0" : ""
                        }`}
                    />
                    <span
                      className={`relative my-1.5 block h-0.5 w-[30px] bg-black transition-all duration-300 dark:bg-white ${navbarOpen ? " top-[-8px] -rotate-45" : ""
                        }`}
                    />
                  </button>
                  <nav
                    id="navbarCollapse"
                    className={`navbar absolute right-0 top-[72px] z-30 w-[250px] rounded border-[.5px] border-body-color/50 bg-white px-6 py-4 duration-300 dark:border-body-color/20 dark:bg-dark lg:visible lg:static lg:w-auto lg:border-none lg:!bg-transparent lg:p-0 lg:opacity-100 ${navbarOpen ? "visibility opacity-100" : "invisible opacity-0"
                      }`}
                  >
                    <ul className="block lg:flex lg:space-x-12">
                      {/* Existing menu items */}
                      {menuData.map((menuItem, index) => (
                        <li key={index} className="group relative">
                          {menuItem.path ? (
                            <Link
                              href={menuItem.path}
                              className={`flex py-2 text-base lg:mr-0 lg:inline-flex lg:px-0 lg:py-6 ${usePathName === menuItem.path
                                ? "text-primary dark:text-white"
                                : "text-dark hover:text-primary dark:text-white/70 dark:hover:text-white"
                                }`}
                            >
                              {menuItem.title}
                            </Link>
                          ) : (
                            <>
                              <p
                                onClick={() => handleSubmenu(index)}
                                className="flex cursor-pointer items-center justify-between py-2 text-base text-dark group-hover:text-primary dark:text-white/70 dark:group-hover:text-white lg:mr-0 lg:inline-flex lg:px-0 lg:py-6"
                              >
                                {menuItem.title}
                                <span className="pl-3">
                                  <svg width="25" height="24" viewBox="0 0 25 24">
                                    <path
                                      fillRule="evenodd"
                                      clipRule="evenodd"
                                      d="M6.29289 8.8427C6.68342 8.45217 7.31658 8.45217 7.70711 8.8427L12 13.1356L16.2929 8.8427C16.6834 8.45217 17.3166 8.45217 17.7071 8.8427C18.0976 9.23322 18.0976 9.86639 17.7071 10.2569L12 15.964L6.29289 10.2569C5.90237 9.86639 5.90237 9.23322 6.29289 8.8427Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                              </p>
                              <div
                                className={`submenu relative left-0 top-full rounded-sm bg-white transition-[top] duration-300 group-hover:opacity-100 dark:bg-dark lg:invisible lg:absolute lg:top-[110%] lg:block lg:w-[250px] lg:p-4 lg:opacity-0 lg:shadow-lg lg:group-hover:visible lg:group-hover:top-full ${openIndex === index ? "block" : "hidden"
                                  }`}
                              >
                                {menuItem.submenu?.map((submenuItem, i) => (
                                  <Link
                                    href={submenuItem.path}
                                    key={i}
                                    className="block rounded py-2.5 text-sm text-dark hover:text-primary dark:text-white/70 dark:hover:text-white lg:px-3"
                                  >
                                    {submenuItem.title}
                                  </Link>
                                ))}
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                    {/* Right side area */}
                    <div className="block lg:hidden border-t border-gray-200 dark:border-gray-600 mt-4 pt-4">

                      {status === "authenticated" && session ? (
                        <div className="flex flex-col space-y-2"> {/* Changed to flex-col */}
                          <Link
                            href="/chat"
                            className="flex items-center px-4 py-2 text-base text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                            <FaComment className="mr-2" />
                            Sohbet
                          </Link>

                          <Link
                            href="/match"
                            className="flex items-center px-4 py-2 text-base text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                            <FaKissWinkHeart className="mr-2" />
                            Eşleştirme
                          </Link>



                          <Link
                            href={`/profile/${userData?.username || 'me'}`}
                            className="flex items-center px-4 py-2 text-base text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                            <FaUserCircle className="mr-2" />
                            Profilim
                          </Link>

                          <Link
                            href="/settings"
                            className="flex items-center px-4 py-2 text-base text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                            <IoIosSettings className="mr-2" />
                            Ayarlar
                          </Link>

                          <button
                            onClick={handleMobileNotificationClick}
                            className="flex items-center w-full px-4 py-2 text-base text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                          >
                            <FaBell className="mr-2" />
                            <span>Bildirimler</span>
                            {notificationCount > 0 && (
                              <span className="ml-2 bg-[#D63384] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {notificationCount > 9 ? '9+' : notificationCount}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={async () => {
                              try {
                                // Backend API'ye logout isteği gönder
                                if (session?.user?.accessToken) {
                                  await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/auth/logout`, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${session.user.accessToken}`,
                                      'Content-Type': 'application/json'
                                    }
                                  });
                                }
                                
                                // Frontend oturumunu sonlandır
                                await signOut({
                                  redirect: true,
                                  callbackUrl: '/'
                                });
                              } catch (error) {
                                console.error("Çıkış yapılırken bir hata oluştu:", error);
                                // Hata olsa bile frontend oturumunu sonlandırmaya çalış
                                await signOut({
                                  redirect: true,
                                  callbackUrl: '/'
                                });
                              }
                            }}
                            className="flex items-center w-full px-4 py-2 text-base text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600"
                          >
                            <FaSignOutAlt className="mr-2" />
                            Çıkış
                          </button>

                        </div>

                      ) : (
                        /* User is not logged in */


                        <div className="flex flex-col space-y-4">
                          <Link
                            href="/signin"
                            className="group flex items-center px-4 py-2 text-base font-medium text-white/90 rounded-lg border border-pink-500/30 backdrop-blur-sm transition-all duration-300 hover:border-pink-500/60 hover:bg-white/5"
                          >
                            <FaHeart className="mr-2 text-pink-500 transition-all duration-300 group-hover:scale-110 group-hover:text-[#D63384]" />
                            <span className="transition-colors duration-300 group-hover:text-[#D63384]">Giriş</span>
                          </Link>
                          <Link
                            href="/signup"
                            className="flex items-center px-4 py-2 text-base font-medium text-white bg-gradient-to-r from-[#8A2BE2] to-[#D63384] rounded-lg transition-all duration-300 hover:opacity-90 hover:shadow-[0_0_10px_rgba(214,51,132,0.5)]"
                          >
                            <span>Kayıt Ol</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  </nav>
                </div>
                {/* Desktop Menu */}
                <div className="hidden lg:flex lg:items-center lg:space-x-12">
                  {status === "authenticated" && session ? (
                    <>
                      <Link
                        href="/chat"
                        className="flex items-center text-base font-medium text-white/90 hover:text-[#D63384] transition-colors duration-300"
                      >
                        <FaComment className="mr-2 text-pink-500 transition-all duration-300 group-hover:scale-110" />
                        Sohbet
                      </Link>

                      <Link
                        href="/match"
                        className="flex items-center text-base font-medium text-white/90 hover:text-[#D63384] transition-colors duration-300"
                      >
                        <FaKissWinkHeart className="mr-2 text-pink-500 transition-all duration-300 group-hover:scale-110" />
                        Eşleştirme
                      </Link>




                      <div className="relative group">
                        <button className="flex items-center text-base font-medium text-white/90 hover:text-[#D63384] transition-colors duration-300">
                          <FaUserCircle className="mr-2 text-pink-500 transition-all duration-300 group-hover:scale-110" />
                          <span>Hesabım</span>
                        </button>
                        <div className="absolute right-0 hidden w-48 py-2 mt-0 bg-white/10 backdrop-blur-sm rounded-lg border border-pink-500/20 shadow-xl group-hover:block dark:bg-gray-800/90">
                          <Link
                            href={`/profile/${userData?.username || 'me'}`}
                            className="flex items-center px-4 py-2 text-sm text-white/90 hover:text-[#D63384] hover:bg-white/5 transition-all duration-300"
                          >
                            <FaUserCircle className="mr-2 text-pink-500" />
                            Profilim
                          </Link>
                          <Link
                            href="/settings"
                            className="flex items-center px-4 py-2 text-sm text-white/90 hover:text-[#D63384] hover:bg-white/5 transition-all duration-300"
                          >
                            <IoIosSettings className="mr-2 text-pink-500" />
                            Ayarlar
                          </Link>
                                                    <button
                            onClick={async () => {
                              try {
                                // Backend API'ye logout isteği gönder
                                if (session?.user?.accessToken) {
                                  await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/auth/logout`, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${session.user.accessToken}`,
                                      'Content-Type': 'application/json'
                                    }
                                  });
                                }
                                
                                // Frontend oturumunu sonlandır
                                await signOut({
                                  redirect: true,
                                  callbackUrl: '/'
                                });
                              } catch (error) {
                                console.error("Çıkış yapılırken bir hata oluştu:", error);
                                // Hata olsa bile frontend oturumunu sonlandırmaya çalış
                                await signOut({
                                  redirect: true,
                                  callbackUrl: '/'
                                });
                              }
                            }}
                            className="flex items-center w-full px-4 py-2 text-base text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600"
                          >
                            <FaSignOutAlt className="mr-2" />
                            Çıkış
                          </button>
                        </div>
                      </div>
                      <div className="relative" ref={notificationRef}>
                        <button
                          onClick={toggleNotifications}
                          className="flex items-center text-base font-medium text-white/90 hover:text-[#D63384] transition-colors duration-300"
                          aria-label="Notifications"
                        >
                          <FaBell className="text-pink-500 transition-all duration-300 hover:scale-110" />
                          {notificationCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-[#D63384] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                          )}
                        </button>

                        {/* Notification Dropdown */}
                        {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-[#2C2C2E]/95 backdrop-blur-sm rounded-xl shadow-lg border border-pink-500/20 z-50">
                          <div className="p-4 border-b border-[#3C3C3E] flex justify-between items-center">
                            <h3 className="text-white font-medium">Bildirimler</h3>
                            {notificationCount > 0 && (
                              <button
                                onClick={markAllNotificationsAsRead}
                                className="text-sm text-pink-400 hover:text-pink-300"
                              >
                                Tümünü okundu işaretle
                              </button>
                            )}
                          </div>

                          <div
                            className="max-h-96 overflow-y-auto"
                            onScroll={handleNotificationsScroll}
                          >
                            {isLoadingNotifications && notificationsPage === 0 ? (
                              <div className="flex justify-center items-center p-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-pink-500"></div>
                              </div>
                            ) : notifications.length > 0 ? (
                              <ul>
                                {notifications.map((notification) => (
                                  <li
                                    key={notification.id}
                                    className={`p-3 border-b border-[#3C3C3E] hover:bg-[#3C3C3E] cursor-pointer ${!notification.read ? 'bg-[#3C3C3E]/50' : ''}`}
                                    onClick={() => handleNotificationClick(notification)}
                                  >
                                    <div className="flex items-start">
                                      <div className="mr-3 mt-1">
                                        {getNotificationIcon(notification.type)}
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm text-white">
                                          {notification.content || formatNotificationMessage(notification)}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                          {formatTimestamp(notification.time)}
                                        </p>
                                      </div>
                                      {!notification.read && (
                                        <div className="w-2 h-2 rounded-full bg-[#D63384] flex-shrink-0 mt-2"></div>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="p-4 text-center text-gray-400">
                                <p>Bildirim bulunmamaktadır</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center space-x-6">
                      <Link
                        href="/signin"
                        className="group relative flex items-center px-7 py-3 text-base font-medium text-white overflow-hidden rounded-full border border-pink-500/30 backdrop-blur-sm transition-all duration-300 hover:border-pink-500/60 hover:bg-white/5"
                      >
                        <FaHeart className="mr-2 text-pink-500 transition-all duration-300 group-hover:scale-110 group-hover:text-[#D63384]" />
                        <span className="relative z-10 transition-colors duration-300 group-hover:text-[#D63384]">Giriş</span>
                      </Link>
                      <Link
                        href="/signup"
                        className="flex items-center px-8 py-3 text-base font-medium text-white bg-gradient-to-r from-[#8A2BE2] to-[#D63384] rounded-full transition-all duration-300 hover:shadow-[0_0_15px_rgba(138,43,226,0.5)] hover:scale-105"
                      >
                        Kayıt Ol
                      </Link>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </header>
      </div>
      {renderMobileNotificationsModal()}
    </>
  );
};

export default Header;