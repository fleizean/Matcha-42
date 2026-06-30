"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import { FiCalendar, FiLoader, FiPlus, FiRefreshCw } from "react-icons/fi";
import EventCard from "@/components/Events/EventCard";
import EventFormModal from "@/components/Events/EventFormModal";
import { acceptEvent, cancelEvent, createEvent, declineEvent, getEvents } from "@/services/events";
import { CreateEventPayload, CurrentUser, MatchOption, MatchaEvent } from "@/types/events";

const tabs = [
  { key: "upcoming", label: "Yaklaşan" },
  { key: "pending", label: "Bekleyen" },
  { key: "past", label: "Geçmiş" },
  { key: "cancelled", label: "İptal" },
  { key: "all", label: "Tümü" }
] as const;

type EventFilter = typeof tabs[number]["key"];

const normalizeList = <T,>(data: any): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const getApiError = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    const detail = data?.detail || data?.message || data?.error;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
  } catch {
    // Ignore parse errors.
  }

  return `${fallback} (${response.status})`;
};

const sortByStartDate = (events: MatchaEvent[]) =>
  [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

const EventsContent = () => {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const queryUserId = searchParams.get("user");
  const queryUsername = searchParams.get("username");
  const hasOpenedFromQuery = useRef(false);

  const [events, setEvents] = useState<MatchaEvent[]>([]);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeFilter, setActiveFilter] = useState<EventFilter>("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  const token = session?.user?.accessToken;

  useEffect(() => {
    document.title = "Randevular | CrushIt";
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    if (!token) return null;

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(await getApiError(response, "Kullanıcı bilgileri alınamadı"));
    }

    return response.json();
  }, [token]);

  const fetchMatches = useCallback(async () => {
    if (!token) return [];

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/interactions/matches?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(await getApiError(response, "Eşleşmeler yüklenemedi"));
    }

    return normalizeList<MatchOption>(await response.json());
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token) {
      setIsLoading(status === "loading");
      return;
    }

    try {
      setIsLoading(true);
      const [eventsData, matchesData, userData] = await Promise.all([
        getEvents(token),
        fetchMatches(),
        fetchCurrentUser()
      ]);

      setEvents(normalizeList<MatchaEvent>(eventsData));
      setMatches(matchesData);
      setCurrentUser(userData);
    } catch (error) {
      console.error("Events load error:", error);
      toast.error(error instanceof Error ? error.message : "Randevular yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  }, [fetchCurrentUser, fetchMatches, status, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if ((queryUserId || queryUsername) && !hasOpenedFromQuery.current) {
      hasOpenedFromQuery.current = true;
      setIsModalOpen(true);
    }
  }, [queryUserId, queryUsername]);

  const resolvedInitialRecipientId = useMemo(() => {
    if (queryUserId) return queryUserId;
    if (queryUsername) {
      return matches.find((match) => match.username === queryUsername)?.user_id || null;
    }
    return null;
  }, [matches, queryUserId, queryUsername]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();

    const filtered = events.filter((event) => {
      const statusValue = String(event.status || "").toLowerCase();
      const startsAt = new Date(event.starts_at).getTime();
      const isPast = !Number.isNaN(startsAt) && startsAt < now;

      switch (activeFilter) {
        case "upcoming":
          return !isPast && statusValue === "accepted";
        case "pending":
          return statusValue === "pending";
        case "past":
          return isPast && !["cancelled", "declined"].includes(statusValue);
        case "cancelled":
          return ["cancelled", "declined"].includes(statusValue);
        case "all":
        default:
          return true;
      }
    });

    return sortByStartDate(filtered);
  }, [activeFilter, events]);

  const handleSubmit = async (payload: CreateEventPayload) => {
    if (!token) return;

    try {
      setIsSubmitting(true);
      const created = await createEvent(token, payload);
      setEvents((prev) => sortByStartDate([created, ...prev]));
      setIsModalOpen(false);
      toast.success("Randevu daveti gönderildi");
    } catch (error) {
      console.error("Create event error:", error);
      toast.error(error instanceof Error ? error.message : "Randevu oluşturulamadı");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshEvents = async () => {
    if (!token) return;

    const data = await getEvents(token);
    setEvents(normalizeList<MatchaEvent>(data));
  };

  const runEventAction = async (
    eventId: string | number,
    action: (token: string, eventId: string | number) => Promise<MatchaEvent>,
    successMessage: string
  ) => {
    if (!token) return;

    try {
      setActionLoading(eventId);
      await action(token, eventId);
      await refreshEvents();
      toast.success(successMessage);
    } catch (error) {
      console.error("Event action error:", error);
      toast.error(error instanceof Error ? error.message : "İşlem tamamlanamadı");
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading") {
    return <EventsLoading />;
  }

  if (status === "unauthenticated") {
    return (
      <section className="min-h-screen bg-[#1C1C1E] px-4 pt-[150px] text-center text-white">
        <Toaster position="top-right" />
        <FiCalendar className="mx-auto mb-4 h-12 w-12 text-[#D63384]" />
        <h1 className="text-2xl font-semibold">Randevuları görmek için giriş yapın</h1>
        <p className="mt-2 text-gray-400">Etkinlik davetlerinizi yönetmek için oturum açmanız gerekiyor.</p>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#1C1C1E] pb-[80px] pt-[130px]">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-pink-500/20 bg-pink-500/10 px-4 py-2 text-sm text-pink-100">
              <FiCalendar className="mr-2 text-[#D63384]" />
              Eşleşmelerinle plan yap
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Randevular</h1>
            <p className="mt-2 max-w-2xl text-gray-400">
              Bekleyen davetleri yanıtla, yaklaşan buluşmalarını takip et veya yeni bir tarih planla.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center rounded-full bg-[#2C2C2E] px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-[#3C3C3E] disabled:opacity-50"
            >
              <FiRefreshCw className={`mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Yenile
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              <FiPlus className="mr-2" />
              Yeni Randevu
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl bg-[#2C2C2E] p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeFilter === tab.key
                  ? "bg-[#D63384] text-white shadow-lg shadow-pink-500/20"
                  : "text-gray-300 hover:bg-[#3C3C3E] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl bg-[#2C2C2E]">
            <FiLoader className="h-10 w-10 animate-spin text-[#D63384]" />
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid gap-5">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                currentUserId={currentUser?.id}
                actionLoading={actionLoading}
                onAccept={(eventId) => runEventAction(eventId, acceptEvent, "Randevu kabul edildi")}
                onDecline={(eventId) => runEventAction(eventId, declineEvent, "Randevu reddedildi")}
                onCancel={(eventId) => runEventAction(eventId, cancelEvent, "Randevu iptal edildi")}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#3C3C3E] bg-[#2C2C2E] p-10 text-center">
            <FiCalendar className="mx-auto mb-4 h-12 w-12 text-[#D63384]" />
            <h2 className="text-xl font-semibold text-white">Bu filtrede randevu yok</h2>
            <p className="mx-auto mt-2 max-w-md text-gray-400">
              Yeni bir davet oluşturabilir veya diğer sekmelerdeki randevularınızı kontrol edebilirsiniz.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-6 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] px-6 py-3 font-medium text-white transition hover:opacity-90"
            >
              Randevu Planla
            </button>
          </div>
        )}
      </div>

      <EventFormModal
        isOpen={isModalOpen}
        matches={matches}
        initialRecipientId={resolvedInitialRecipientId}
        initialUsername={queryUsername}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </section>
  );
};

const EventsLoading = () => (
  <section className="min-h-screen bg-[#1C1C1E] px-4 pt-[150px]">
    <div className="container mx-auto flex min-h-[320px] items-center justify-center rounded-2xl bg-[#2C2C2E]">
      <FiLoader className="h-10 w-10 animate-spin text-[#D63384]" />
    </div>
  </section>
);

const EventsPage = () => (
  <Suspense fallback={<EventsLoading />}>
    <EventsContent />
  </Suspense>
);

export default EventsPage;
