"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiSend, FiMoreVertical, FiSearch, FiCircle, FiSlash, FiFlag } from "react-icons/fi";
import { Metadata } from "next";

const metadata: Metadata = {
  title: "Mesajlar | CrushIt",
  description: "CrushIt platformunda mesajlarınızı yönetin."
};

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
  senderId: string;
  text: string;
  timestamp: string;
}

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");


  useEffect(() => {
    document.title = metadata.title as string;
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBlock = () => {
    setShowBlockModal(true);
    setShowMenu(false);
  };

  const handleReport = () => {
    setShowReportModal(true);
    setShowMenu(false);
  };

  const confirmBlock = () => {
    // API call to block user
    alert("Kullanıcı engellendi");
    setShowBlockModal(false);
  };

  const submitReport = () => {
    // API call to report user
    alert("Kullanıcı rapor edildi");
    setShowReportModal(false);
    setReportReason("");
    setReportDescription("");
  };

  const mockChats: ChatUser[] = [
    {
      id: "1",
      name: "Ayşe Yılmaz",
      avatar: "https://images7.alphacoders.com/121/1218824.jpg",
      lastMessage: "Merhaba, nasılsın?",
      lastMessageTime: "14:30",
      isOnline: true,
      unreadCount: 2
    },
    {
      id: "2",
      name: "Mehmet Demir",
      avatar: "https://images7.alphacoders.com/110/1104374.jpg",
      lastMessage: "Yarın buluşalım mı?",
      lastMessageTime: "Dün",
      isOnline: false
    }
  ];

  const mockMessages: Message[] = [
    {
      id: "1",
      senderId: "1",
      text: "Merhaba, nasılsın?",
      timestamp: "14:30"
    },
    {
      id: "2",
      senderId: "current-user",
      text: "İyiyim, teşekkürler. Sen nasılsın?",
      timestamp: "14:31"
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const newMsg: Message = {
        id: Date.now().toString(),
        senderId: "current-user",
        text: newMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMsg]);
      setNewMessage("");
    }
  };

  return (
    <section className="pt-[150px] pb-[120px] bg-[#1C1C1E] min-h-screen">
      <div className="container mx-auto px-4">
        <div className="flex bg-[#2C2C2E] rounded-xl overflow-hidden" style={{ height: "calc(100vh - 300px)" }}>
          {/* Chat List */}
          <div className="w-1/3 border-r border-[#3C3C3E]">
            <div className="p-4 border-b border-[#3C3C3E]">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Sohbet ara..."
                  className="w-full bg-[#3C3C3E] text-white rounded-lg pl-10 pr-4 py-2"
                />
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="overflow-y-auto" style={{ height: "calc(100% - 72px)" }}>
              {mockChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`p-4 flex items-center cursor-pointer hover:bg-[#3C3C3E] transition-colors ${activeChat === chat.id ? "bg-[#3C3C3E]" : ""
                    }`}
                  onClick={() => setActiveChat(chat.id)}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <Image
                        src={chat.avatar}
                        alt={chat.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {chat.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-[#2C2C2E]" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="text-white font-semibold">{chat.name}</h3>
                      <span className="text-xs text-gray-400">{chat.lastMessageTime}</span>
                    </div>
                    <p className="text-gray-400 text-sm truncate">{chat.lastMessage}</p>
                  </div>
                  {chat.unreadCount && (
                    <div className="ml-2 bg-[#D63384] rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="text-white text-xs">{chat.unreadCount}</span>
                    </div>
                  )}
                </div>
              ))}
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

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {activeChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-[#3C3C3E] flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <Image
                          src={mockChats.find(c => c.id === activeChat)?.avatar || ""}
                          alt="Active chat"
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-white font-semibold">
                        {mockChats.find(c => c.id === activeChat)?.name}
                      </h3>
                      <p className="text-xs text-gray-400">Çevrimiçi</p>
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

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {mockMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === "current-user" ? "justify-end" : "justify-start"
                        }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${message.senderId === "current-user"
                            ? "bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white"
                            : "bg-[#3C3C3E] text-white"
                          }`}
                      >
                        <p>{message.text}</p>
                        <span className="text-xs text-gray-300 mt-1 block">
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-[#3C3C3E]">
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Mesajınızı yazın..."
                      className="flex-1 bg-[#3C3C3E] text-white rounded-lg px-4 py-2"
                    />
                    <button
                      type="submit"
                      className="p-2 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] text-white"
                      disabled={!newMessage.trim()}
                    >
                      <FiSend size={20} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">Sohbet başlatmak için bir kişi seçin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatPage;