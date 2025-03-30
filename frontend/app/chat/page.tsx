"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiSend, FiMoreVertical, FiSearch, FiCircle, FiSlash, FiFlag, FiArrowLeft, FiLoader } from "react-icons/fi";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { Metadata } from "next";
import WebSocketService from "@/services/websocket";

const metadata: Metadata = {
  title: "Mesajlar | CrushIt",
  description: "CrushIt platformunda mesajlarınızı yönetin."
};

interface BlockStatus {
  is_blocked: boolean;
  blocked_by_me: boolean;
  blocked_by_them: boolean;
  blocker_id: string | null;
}

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string;
  isOnline: boolean;
  unreadCount?: number;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Conversation {
  connection: {
    id: number;
    user1_id: string;
    user2_id: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  user: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    is_online: boolean;
    last_online: string;
  };
  recent_message: {
    id: number;
    sender_id: string;
    recipient_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
  } | null;
  unread_count: number;

  profile_picture?: string;
}

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const wsService = useRef<WebSocketService>(WebSocketService.getInstance());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [isBlockLoading, setIsBlockLoading] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [blockStatus, setBlockStatus] = useState<BlockStatus>({
    is_blocked: false,
    blocked_by_me: false,
    blocked_by_them: false,
    blocker_id: null
  });

  useEffect(() => {
    document.title = metadata.title as string;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Temizleme işlevi için bir bayrak
    let isMounted = true;

    if (session?.user?.accessToken) {
      // WebSocket'i kur
      setupWebSocket();

      // Konuşmaları getir
      fetchConversations();

      // Aktif sohbet varsa mesajları getir
      if (activeChat) {
        fetchMessages(activeChat);
      }
    }

    return () => {
      isMounted = false;
      // Bileşen kaldırıldığında WebSocket bağlantısını kapat
      wsService.current.disconnect();
    };
  }, [session, activeChat]);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat);
    }
  }, [activeChat]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
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
          setCurrentUserId(userData.id);
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };

    fetchCurrentUser();
  }, [session]);

  const setupWebSocket = () => {
    if (!session?.user?.accessToken || !process.env.NEXT_PUBLIC_BACKEND_API_URL) {
      toast.error('WebSocket bağlantısı kurulamadı');
      return;
    }

    // First, clean up by disconnecting any existing connection
    wsService.current.disconnect();

    // Define handlers
    // WebSocket mesaj işleyiciyi güncelleyin
    const handleWsMessage = (data: any) => {
      console.log("WebSocket message received:", data);

      if (data.type === 'message') {
        // Gelen mesaj mevcut aktif sohbeti ilgilendiriyor mu kontrol et
        const isCurrentChat =
          activeChat &&
          (data.sender_id === activeChat || data.recipient_id === activeChat);

        // Eğer bu aktif sohbetle ilgiliyse mesajlar listesine ekle
        if (isCurrentChat) {
          // Mesaj zaman damgasını doğru formatta ayarla
          const timestamp = data.timestamp || new Date().toISOString();

          // Yeni mesajı oluştur
          const newMsg: Message = {
            id: data.id || Date.now().toString(),
            sender_id: data.sender_id,
            recipient_id: data.recipient_id || currentUserId,
            content: data.content,
            created_at: timestamp,
            is_read: false
          };

          // Mesajlar listesini güncelle
          setMessages(prevMessages => {
            // Eğer mesaj zaten listede varsa tekrar ekleme
            const msgExists = prevMessages.some(m => m.id === newMsg.id);
            if (msgExists) return prevMessages;

            // Yeni mesaj dizisini oluştur
            const updatedMessages = [...prevMessages, newMsg];

            // Mesaj eklendikten sonra, setTimeout ile aşağı kaydır
            setTimeout(() => {
              scrollToBottom();
            }, 100);

            return updatedMessages;
          });

          // Otomatik olarak en aşağı kaydır

        }

        // Her durumda konuşma listesini güncelle
        fetchConversations();
      }
    };

    const handleWsConnect = () => {
      console.log('WebSocket connected successfully');
      setWsConnected(true);
    };

    const handleWsDisconnect = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };

    const handleWsError = (error: Event) => {
      console.error('WebSocket error occurred');
      setWsConnected(false);
      // Don't show a toast on initial error - this can be annoying for users
    };

    // Clear any existing handlers
    wsService.current.removeMessageHandler(handleWsMessage);
    wsService.current.removeConnectHandler(handleWsConnect);
    wsService.current.removeDisconnectHandler(handleWsDisconnect);
    wsService.current.removeErrorHandler(handleWsError);

    // Add new handlers
    wsService.current.addMessageHandler(handleWsMessage);
    wsService.current.addConnectHandler(handleWsConnect);
    wsService.current.addDisconnectHandler(handleWsDisconnect);
    wsService.current.addErrorHandler(handleWsError);

    // Initialize connection only once, after a small delay
    setTimeout(() => {
      wsService.current.connect(
        process.env.NEXT_PUBLIC_BACKEND_API_URL,
        session.user.accessToken
      );
    }, 500);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (!query.trim()) {
      // Arama sorgusu yoksa filtrelenmiş konuşmaları temizle
      setFilteredConversations([]);
      return;
    }

    // İsime göre filtreleme yapın
    const filtered = conversations.filter(conv =>
      `${conv.user.first_name} ${conv.user.last_name}`.toLowerCase().includes(query) ||
      (conv.recent_message?.content && conv.recent_message.content.toLowerCase().includes(query))
    );

    setFilteredConversations(filtered);
  };

  const fetchConversations = async () => {
    if (!session?.user?.accessToken) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/conversations`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Bu kullanıcı ile mesajlaşma yetkiniz bulunmamaktadır.');
        } else {
          toast.error('Kullanıcı bulunamadı veya bağlantı kurulamadı.');
        }

        // URL'den user parametresini kaldır
        router.replace('/chat');

        // Aktif sohbeti temizle
        setActiveChat(null);
        return;
      }

      const data: Conversation[] = await response.json();
      setConversations(data);

      const conversationsWithProfiles = [...data];

      const profilePromises = data.map(async (conv) => {
        try {
          const profileData = await fetchUserProfileDetails(conv.user.username);
          if (profileData && profileData.pictures && profileData.pictures.length > 0) {
            const primaryPic = profileData.pictures.find(pic => pic.is_primary) || profileData.pictures[0];
            conv.profile_picture = primaryPic.backend_url;
          }
        } catch (error) {
          console.error(`Error fetching profile for ${conv.user.username}:`, error);
        }
        return conv;
      });

      // URL'den alınan kullanıcı ID'si
      const params = new URLSearchParams(window.location.search);
      const userIdFromUrl = params.get('user');
      console.log('userIdFromUrl:', userIdFromUrl);
      console.log('conversations:', conversations);
      if (userIdFromUrl && session?.user?.accessToken && conversations.length > 0) {
        const urlConversation = data.find(c => c.user.id === userIdFromUrl);

        if (urlConversation) {
          // URL'deki kullanıcı konuşmalar arasında varsa, onu seç
          setActiveChat(userIdFromUrl);
          setActiveChatUser({
            id: urlConversation.user.id,
            name: `${urlConversation.user.first_name} ${urlConversation.user.last_name}`,
            avatar: urlConversation.profile_picture || '/images/defaults/man-default.png', // Profil fotoğrafını ekle
            lastMessage: urlConversation.recent_message?.content || 'Henüz mesaj yok',
            lastMessageTime: urlConversation.recent_message
              ? formatTimestamp(urlConversation.recent_message.created_at)
              : '',
            isOnline: urlConversation.user.is_online,
            unreadCount: urlConversation.unread_count
          });
        }
      }
      // URL'de kullanıcı yoksa ve aktif sohbet yoksa, ilk konuşmayı seç
      else if (data.length > 0 && !activeChat) {
        setActiveChat(data[0].user.id);
        setActiveChatUser({
          id: data[0].user.id,
          name: `${data[0].user.first_name} ${data[0].user.last_name}`,
          avatar: data[0].profile_picture || '/images/defaults/man-default.png', // Profil fotoğrafını ekle
          lastMessage: data[0].recent_message?.content || 'Henüz mesaj yok',
          lastMessageTime: data[0].recent_message
            ? formatTimestamp(data[0].recent_message.created_at)
            : '',
          isOnline: data[0].user.is_online,
          unreadCount: data[0].unread_count
        });
      }

      const updatedConversations = await Promise.all(profilePromises);
      setConversations(updatedConversations);
    } catch (error) {
      console.error('Conversations fetch error:', error);
      toast.error('Konuşmalar yüklenemedi');

      router.replace('/chat');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    if (!session?.user?.accessToken) return;

    setIsLoadingMessages(true);

    try {
      // First get the username for block check
      const userResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/get-by-user_id/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user');
      }

      const userData = await userResponse.json();

      // Check block status
      const blockStatusResult = await checkBlockStatus(userData.username);
      setBlockStatus(blockStatusResult || {
        is_blocked: false,
        blocked_by_me: false,
        blocked_by_them: false,
        blocker_id: null
      });

      // If blocked, don't fetch messages
      if (blockStatusResult?.blocked_by_me || blockStatusResult?.blocked_by_them) {
        setMessages([]);
        return;
      }

      // If not blocked, proceed with message fetch
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/messages/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data: Message[] = await response.json();
      console.log("data: ", data);
      setMessages(data);

      // Update conversations unread count
      const updatedConversations = conversations.map(conv => {
        if (conv.user.id === userId) {
          return { ...conv, unread_count: 0 };
        }
        return conv;
      });

      setConversations(updatedConversations);

    } catch (error) {
      console.error('Messages fetch error:', error);
      toast.error('Mesajlar yüklenemedi');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const checkBlockStatus = async (username: string) => {
    if (!session?.user?.accessToken) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/is_blocked?blocked_username=${username}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) throw new Error('Failed to check block status');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Block status check error:', error);
      return null;
    }
  };

  // handleSendMessage fonksiyonunda WebSocket kontrolünü güncelleyin
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !activeChat || !session?.user?.accessToken || !currentUserId) return;

    // Geçici ID oluştur
    const tempId = `temp-${Date.now()}`;

    try {
      // Önce mesajı UI'a ekle (iyimser güncelleme)
      const tempMessage: Message = {
        id: tempId,
        sender_id: currentUserId,
        recipient_id: activeChat,
        content: newMessage,
        created_at: new Date().toISOString(),
        is_read: false
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage("");

      // İlk önce WebSocket ile göndermeyi dene
      if (wsService.current.isConnected()) {
        wsService.current.send({
          type: 'message',
          recipientId: activeChat,
          content: newMessage
        });

        // WebSocket gönderimi başarılı ise, konuşma listesini güncelle
        setTimeout(() => {
          fetchConversations();
        }, 1000);

        return; // WebSocket başarılı ise REST API'ye gitmeden dön
      }

      // WebSocket bağlı değilse REST API'yi kullan
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/realtime/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient_id: activeChat,
            content: newMessage
          })
        }
      );

      if (!response.ok) throw new Error('Failed to send message via REST API');

      const data = await response.json();

      // Geçici mesajı gerçek olanla değiştir
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? {
          ...msg,
          id: data.id,
          timestamp: data.created_at
        } : msg
      ));

      fetchConversations();

    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Mesaj gönderilemedi');

      // Hata durumunda geçici mesajı kaldır
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  useEffect(() => {
    if (activeChat && conversations.length > 0) {
      const conversation = conversations.find(c => c.user.id === activeChat);

      if (conversation) {
        // Mevcut avatar'ı saklayalım, böylece zaten yüklenen fotoğraf kaybolmaz
        const currentAvatar = activeChatUser?.avatar;

        setActiveChatUser({
          id: conversation.user.id,
          name: `${conversation.user.first_name} ${conversation.user.last_name}`,
          // Eğer bir profil fotoğrafı varsa onu kullan, yoksa mevcut avatar'ı veya varsayılanı kullan
          avatar: conversation.profile_picture || currentAvatar || '/images/defaults/man-default.png',
          lastMessage: conversation.recent_message?.content || 'Henüz mesaj yok',
          lastMessageTime: conversation.recent_message
            ? formatTimestamp(conversation.recent_message.created_at)
            : '',
          isOnline: conversation.user.is_online,
          unreadCount: conversation.unread_count
        });
      }
    }
  }, [activeChat, conversations]);

  useEffect(() => {
    // Make sure both session and conversations are available before proceeding
    if (session?.user?.accessToken && conversations.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const userIdFromUrl = params.get('user');
      
      // If URL has a user parameter, find that conversation
      if (userIdFromUrl) {
        const urlConversation = conversations.find(c => c.user.id === userIdFromUrl);
        
        if (urlConversation) {
          // Set active chat and fetch messages
          setActiveChat(userIdFromUrl);
          
          // Set active chat user data
          setActiveChatUser({
            id: urlConversation.user.id,
            name: `${urlConversation.user.first_name} ${urlConversation.user.last_name}`,
            avatar: urlConversation.profile_picture || '/images/defaults/man-default.png',
            lastMessage: urlConversation.recent_message?.content || 'Henüz mesaj yok',
            lastMessageTime: urlConversation.recent_message
              ? formatTimestamp(urlConversation.recent_message.created_at)
              : '',
            isOnline: urlConversation.user.is_online,
            unreadCount: urlConversation.unread_count
          });
        }
      }
      // If no user in URL and no active chat yet, select the first conversation
      else if (!activeChat) {
        setActiveChat(conversations[0].user.id);
        
        setActiveChatUser({
          id: conversations[0].user.id,
          name: `${conversations[0].user.first_name} ${conversations[0].user.last_name}`,
          avatar: conversations[0].profile_picture || '/images/defaults/man-default.png',
          lastMessage: conversations[0].recent_message?.content || 'Henüz mesaj yok',
          lastMessageTime: conversations[0].recent_message
            ? formatTimestamp(conversations[0].recent_message.created_at)
            : '',
          isOnline: conversations[0].user.is_online,
          unreadCount: conversations[0].unread_count
        });
      }
    }
  }, [session, conversations]);

  // İlk olarak conversations bağımlılığını ekleyelim
  useEffect(() => {
    // İlk yükleme sırasında URL'yi kontrol et
    const params = new URLSearchParams(window.location.search);
    const userIdFromUrl = params.get('user');

    if (userIdFromUrl && session?.user?.accessToken) {
      // URL'de bir kullanıcı ID'si varsa, konuşmalar yüklendikten sonra kontrol edilecek

      // Aktif sohbeti doğrudan ayarla (konuşmalar daha sonra kontrol edilecek)
      setActiveChat(userIdFromUrl);

    }
  }, [session]);

  // WebSocket bağlantı durumunu düzenli olarak kontrol et
  useEffect(() => {
    if (!session?.user?.accessToken) return;

    const interval = setInterval(() => {
      if (!wsService.current.isConnected()) {
        setupWebSocket();
      }
    }, 5000); // Her 5 saniyede bir kontrol et

    return () => clearInterval(interval);
  }, [session]);

  const handleSelectChat = async (userId: string, username: string, user: ChatUser) => {
    // Check block status before setting active chat
    const blockStatusResult = await checkBlockStatus(username);

    if (blockStatusResult?.blocked_by_me || blockStatusResult?.blocked_by_them) {
      toast.error('Bu kullanıcı ile mesajlaşamazsınız');
      router.replace('/chat');

      setActiveChat(null);
      setActiveChatUser(null);
      return;
    }

    setActiveChat(userId);
    setActiveChatUser(user);

    // Rest of the existing code...
  };

  useEffect(() => {
    const checkUrlBlockStatus = async () => {
      const params = new URLSearchParams(window.location.search);
      const userIdFromUrl = params.get('user');

      if (userIdFromUrl && conversations.length > 0) {
        const conversation = conversations.find(c => c.user.id === userIdFromUrl);

        if (conversation) {
          const blockStatusResult = await checkBlockStatus(conversation.user.username);

          if (blockStatusResult?.blocked_by_me || blockStatusResult?.blocked_by_them) {
            toast.error('Bu kullanıcı ile mesajlaşamazsınız');
            router.replace('/chat');
            return;
          }
        }
      }
    };

    checkUrlBlockStatus();
  }, [conversations]);

  const handleBlock = () => {
    setShowBlockModal(true);
    setShowMenu(false);
  };

  const handleReport = () => {
    setShowReportModal(true);
    setShowMenu(false);
  };

  const confirmBlock = async () => {
    if (!session?.user?.accessToken || !activeChat) return;

    try {
      // Yükleme durumu için state ekleyebiliriz
      setIsBlockLoading(true);

      // Önce user_id ile profil bilgilerini al
      const profileResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/get-by-user_id/${activeChat}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profileData = await profileResponse.json();

      if (!profileData.id) {
        throw new Error('Profile ID not found');
      }

      // Şimdi profile_id ile engelleme işlemi yap
      const blockResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/block`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocked_id: profileData.id
          })
        }
      );

      if (!blockResponse.ok) {
        throw new Error('Failed to block user');
      }

      toast.success('Kullanıcı engellendi');
      setShowBlockModal(false);

      // Remove the conversation from the list
      setConversations(prev => prev.filter(conv => conv.user.id !== activeChat));
      setActiveChat(null);
    } catch (error) {
      console.error('Block error:', error);
      toast.error('Kullanıcı engellenemedi');
    } finally {
      // Yükleme durumunu kapat
      setIsBlockLoading(false);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Add this useEffect for immediate URL-based block checking
  useEffect(() => {
    const checkInitialBlockStatus = async () => {
      const params = new URLSearchParams(window.location.search);
      const userIdFromUrl = params.get('user');

      if (!userIdFromUrl || !session?.user?.accessToken) return;

      try {
        // First get the username from user ID
        const userResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/get-by-user_id/${userIdFromUrl}`,
          {
            headers: {
              'Authorization': `Bearer ${session.user.accessToken}`,
            }
          }
        );

        if (!userResponse.ok) {
          throw new Error('Failed to fetch user');
        }

        const userData = await userResponse.json();

        // Check block status using username
        const blockStatusResult = await checkBlockStatus(userData.username);

        if (blockStatusResult?.blocked_by_me || blockStatusResult?.blocked_by_them) {
          toast.error('Bu kullanıcı ile mesajlaşamazsınız');
          router.replace('/chat');
          return;
        }
      } catch (error) {
        console.error('Initial block status check error:', error);
        toast.error('Kullanıcı bilgileri alınamadı');
        router.replace('/chat');
      }
    };

    checkInitialBlockStatus();
  }, [session]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const submitReport = async () => {
    if (!session?.user?.accessToken || !activeChat) return;

    try {
      // Yükleme durumu için state ekleyebiliriz
      setIsReportLoading(true);

      // Önce user_id ile profil bilgilerini al
      const profileResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/get-by-user_id/${activeChat}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profileData = await profileResponse.json();

      if (!profileData.id) {
        throw new Error('Profile ID not found');
      }

      // Şimdi profile_id ile şikayet işlemi yap
      const reportResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/interactions/report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reported_id: profileData.id,
            reason: reportReason,
            description: reportDescription
          })
        }
      );

      if (!reportResponse.ok) {
        throw new Error('Failed to report user');
      }

      toast.success('Kullanıcı rapor edildi');
      setShowReportModal(false);
      setReportReason("");
      setReportDescription("");
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Kullanıcı rapor edilemedi');
    } finally {
      // Yükleme durumunu kapat
      setIsReportLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      if (!timestamp) return "";
      
      let msgDate: Date;
      
      // Backend formatındaki postgresSQL timestamp+timezone formatı (2025-03-31 00:54:09.981732+03)
      if (timestamp.includes(' ') && timestamp.match(/\+\d{2}$/)) {
        // Backend formatı (PostgreSQL timestamp with timezone)
        const parts = timestamp.split(' ');
        const datePart = parts[0];
        const timePart = parts[1].split('.')[0]; // Microseconds'ı kaldır
        
        // ISO benzeri bir string oluştur
        const isoString = `${datePart}T${timePart}`;
        msgDate = new Date(isoString);
      } else {
        // Frontend formatı ISO string (2025-03-30T21:54:09.981732+00:00)
        msgDate = new Date(timestamp);
      }
      
      // Geçerli bir tarih mi kontrol et
      if (isNaN(msgDate.getTime())) {
        console.error('Invalid date format:', timestamp);
        return "";
      }
      
      // Şimdiki zamanı al
      const now = new Date();
      
      // Aynı gün içinde olup olmadığını kontrol et
      const isSameDay = 
        msgDate.getDate() === now.getDate() &&
        msgDate.getMonth() === now.getMonth() &&
        msgDate.getFullYear() === now.getFullYear();
      
      // Yerel saat ve dakikayı al
      const hours = msgDate.getHours();
      const minutes = msgDate.getMinutes();
      
      if (isSameDay) {
        // Aynı gün içindeyse sadece saat ve dakika
        return `${padZero(hours)}:${padZero(minutes)}`;
      } else {
        // Farklı gün ise tarih ve saat
        const dayStr = msgDate.getDate();
        const monthNames = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
        const monthStr = monthNames[msgDate.getMonth()];
        
        return `${dayStr} ${monthStr} ${padZero(hours)}:${padZero(minutes)}`;
      }
    } catch (error) {
      console.error('Timestamp format error:', error);
      console.error('Invalid timestamp:', timestamp);
      return "";
    }
  };
    
    // Sayılara sıfır ekleyen yardımcı fonksiyon
    const padZero = (num: number): string => {
      return num < 10 ? `0${num}` : `${num}`;
    };

  const fetchUserProfileDetails = async (username: string) => {
    if (!session?.user?.accessToken) return null;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/profiles/get-for-chat/${username}`,
        {
          headers: {
            'Authorization': `Bearer ${session.user.accessToken}`,
          }
        }
      );

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('User profile fetch error:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchUserDetailsForUrl = async () => {
      if (activeChat && conversations.length > 0) {
        const conversation = conversations.find(c => c.user.id === activeChat);

        if (conversation && conversation.user.username) {
          const profileDetails = await fetchUserProfileDetails(conversation.user.username);

          if (profileDetails && profileDetails.pictures && profileDetails.pictures.length > 0) {
            const primaryPicture = profileDetails.pictures.find((pic: any) => pic.is_primary) || profileDetails.pictures[0];

            setActiveChatUser(prev => ({
              ...prev!,
              avatar: primaryPicture.backend_url
            }));
          }
        }
      }
    };

    if (activeChat) {
      fetchUserDetailsForUrl();
    }
  }, [activeChat, conversations]);

  return (
    <section className="pt-[100px] pb-[60px] bg-[#1C1C1E] min-h-screen">
      <Toaster position="top-right" />
      <div className="contacontainer mx-auto px-4 h-full">
        <div className="flex flex-col lg:flex-row bg-[#2C2C2E] rounded-xl overflow-hidden h-[calc(100vh-160px)]">
          {/* Chat List - Make it full width on mobile */}
          <div className={`${activeChat ? 'hidden lg:block' : 'block'} lg:w-1/3 border-r border-[#3C3C3E] h-full`}>
            <div className="sticky top-0 bg-[#2C2C2E] p-4 border-b border-[#3C3C3E] z-10">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder="Sohbet ara..."
                  className="w-full bg-[#3C3C3E] text-white rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-[#D63384] transition-all"
                />
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />

                {/* Temizleme butonu */}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilteredConversations([]);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Chat List Scrollable Area */}
            <div className="overflow-y-auto h-[calc(100vh-240px)] scrollbar-thin scrollbar-thumb-[#3C3C3E] scrollbar-track-transparent">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <FiLoader className="w-8 h-8 text-[#D63384] animate-spin" />
                </div>
              ) : conversations.length > 0 ? (
                (searchQuery ? filteredConversations : conversations).map((conv) => (
                  <motion.div
                    key={conv.user.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`p-4 flex items-center cursor-pointer hover:bg-[#3C3C3E] transition-all ${activeChat === conv.user.id ? "bg-[#3C3C3E]" : ""
                      }`}
                    onClick={() => handleSelectChat(conv.user.id, conv.user.username, {
                      id: conv.user.id,
                      name: `${conv.user.first_name} ${conv.user.last_name}`,
                      avatar: conv.profile_picture || '/images/defaults/man-default.png',
                      lastMessage: conv.recent_message?.content || 'Henüz mesaj yok',
                      lastMessageTime: conv.recent_message
                        ? formatTimestamp(conv.recent_message.created_at)
                        : '',
                      isOnline: conv.user.is_online,
                      unreadCount: conv.unread_count
                    })}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden">
                        <Image
                          src={conv.profile_picture || '/images/defaults/man-default.png'}
                          alt={conv.user.first_name}
                          fill
                          className="object-cover"
                          loading="eager"
                          priority
                        />
                      </div>
                      {conv.user.is_online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#2C2C2E]" />
                      )}
                    </div>

                    <div className="ml-3 flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-semibold">
                          {conv.user.first_name} {conv.user.last_name}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {conv.recent_message
                            ? formatTimestamp(conv.recent_message.created_at)
                            : ''}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm truncate">
                        {conv.recent_message?.content || 'Henüz mesaj yok'}
                      </p>
                    </div>

                    {conv.unread_count > 0 && (
                      <div className="ml-2 bg-[#D63384] rounded-full w-5 h-5 flex items-center justify-center">
                        <span className="text-white text-xs">{conv.unread_count}</span>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  <p className="text-gray-400 mb-2">Henüz aktif sohbet bulunmuyor</p>
                  <p className="text-gray-500 text-sm">
                    Birileriyle eşleştiğinizde burada onlarla sohbet edebilirsiniz
                  </p>
                </div>
              )}

              {searchQuery && filteredConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 p-4 text-center">
                  <p className="text-gray-400">{searchQuery} için sonuç bulunamadı</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Farklı bir arama terimi deneyebilir veya filtrelerinizi temizleyebilirsiniz
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Block Confirmation Modal */}
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
                    disabled={isBlockLoading}
                  >
                    İptal
                  </button>
                  <button
                    onClick={confirmBlock}
                    disabled={isBlockLoading}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    {isBlockLoading ? (
                      <>
                        <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        İşleniyor...
                      </>
                    ) : (
                      'Engelle'
                    )}

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
                    disabled={isReportLoading}
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
                    disabled={isReportLoading}
                  >
                    İptal
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={!reportReason || !reportDescription || isReportLoading}
                    className="px-4 py-2 bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {isReportLoading ? (
                      <>
                        <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        İşleniyor...
                      </>
                    ) : (
                      'Raporla'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Area */}
          <div className={`${activeChat ? 'block' : 'hidden lg:block'} flex-1 flex flex-col h-full`}>
            {activeChat ? (
              <>
                <div className="flex flex-col h-full">
                  {/* Chat Header with Back Button on Mobile */}
                  <div className="sticky top-0 bg-[#2C2C2E] p-4 border-b border-[#3C3C3E] flex items-center justify-between z-10">
                    <div className="flex items-center">
                      <button
                        className="lg:hidden mr-3 text-gray-400 hover:text-white"
                        onClick={() => setActiveChat(null)}
                      >
                        <FiArrowLeft size={20} />
                      </button>
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <Image
                            src={activeChatUser?.avatar || '/images/defaults/man-default.png'}
                            alt="Active chat"
                            fill
                            className="object-cover"
                            loading="eager" // Öncelikli yükleme
                            priority
                          />
                        </div>
                        {activeChatUser?.isOnline && (
                          <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border border-[#2C2C2E]" />
                        )}
                      </div>
                      <div className="ml-3">
                        <h3 className="text-white font-semibold">
                          {activeChatUser?.name}
                        </h3>
                        <p className="text-xs text-gray-400">
                          {activeChatUser?.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </p>
                      </div>
                    </div>

                    <div className="relative" ref={menuRef}>
                      <button
                        className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-[#3C3C3E]"
                        onClick={() => setShowMenu(!showMenu)}
                      >
                        <FiMoreVertical size={20} />
                      </button>

                      {showMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-[#2C2C2E] rounded-lg shadow-lg py-2 z-50">
                          <button
                            onClick={handleBlock}
                            className="w-full px-4 py-2 text-left text-white hover:bg-[#3C3C3E] flex items-center"
                          >
                            <FiSlash className="mr-2" />
                            Engelle
                          </button>
                          <button
                            onClick={handleReport}
                            className="w-full px-4 py-2 text-left text-red-500 hover:bg-[#3C3C3E] flex items-center"
                          >
                            <FiFlag className="mr-2" />
                            Raporla
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {blockStatus.is_blocked || blockStatus.blocked_by_me || blockStatus.blocked_by_them ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center p-4">
                        <div className="mb-4">
                          <FiSlash className="w-16 h-16 text-red-500 mx-auto" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">
                          {blockStatus.blocked_by_me ?
                            "Bu Kullanıcıyı Engellediniz" :
                            "Bu Kullanıcı Sizi Engelledi"}
                        </h2>
                        <p className="text-gray-400">
                          {blockStatus.blocked_by_me ?
                            "Bu kullanıcıyı engellediğiniz için mesajlaşamazsınız." :
                            "Bu kullanıcı sizi engellediği için mesajlaşamazsınız."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Messages */}
                      <div className="flex-grow overflow-y-auto p-4 space-y-6"
                        style={{
                          WebkitOverflowScrolling: 'touch',
                          scrollbarWidth: 'none', // Firefox için
                          msOverflowStyle: 'none', // IE ve Edge için
                        }}>
                        {isLoadingMessages ? (
                          <div className="flex items-center justify-center h-full">
                            <FiLoader className="w-8 h-8 text-[#D63384] animate-spin" />
                          </div>
                        ) : messages.length > 0 ? (
                          messages.map((message) => {
                            // Use currentUserId instead of session.user.id
                            const isCurrentUser = currentUserId && String(message.sender_id) === String(currentUserId);

                            return (
                              <motion.div
                                key={message.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                              >
                                {!isCurrentUser && (
                                  <div className="w-8 h-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                                    <Image
                                      src={activeChatUser?.avatar || '/images/defaults/man-default.png'}
                                      alt="User avatar"
                                      width={32}
                                      height={32}
                                      className="object-cover"
                                      loading="eager" // Öncelikli yükleme
                                      priority
                                    />
                                  </div>
                                )}
                                <div
                                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${isCurrentUser
                                    ? "bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white"
                                    : "bg-[#3C3C3E] text-white"
                                    }`}
                                >
                                  <p className="leading-relaxed">{message.content}</p>
                                  <span className="text-xs text-gray-300 mt-2 block">
                                    {message.created_at ? formatTimestamp(message.created_at) : formatTimestamp(new Date().toISOString())}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full">
                            <p className="text-gray-400">Henüz mesaj yok</p>
                            <p className="text-gray-500 text-sm mt-2">Sohbete başlamak için mesaj gönderin</p>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Message Input */}
                      <form onSubmit={handleSendMessage} className="sticky bottom-0 bg-[#2C2C2E] p-4 border-t border-[#3C3C3E]">
                        <div className="flex items-center space-x-4">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Mesajınızı yazın..."
                            className="flex-1 bg-[#3C3C3E] text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#D63384] transition-all"
                          />
                          <motion.button
                            type="submit"
                            whileTap={{ scale: 0.95 }}
                            disabled={!newMessage.trim()}
                            className="p-3 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white disabled:opacity-50 transition-all hover:shadow-lg"
                          >
                            <FiSend size={20} />
                          </motion.button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-400 text-lg">
                    Sohbet başlatmak için bir kişi seçin
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    {conversations.length > 0
                      ? "Sol taraftan bir sohbet seçebilirsiniz"
                      : "Henüz hiç eşleşmeniz yok"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatPage;