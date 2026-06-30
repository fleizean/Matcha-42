import { useEffect, useMemo, useState } from "react";
import { CreateEventPayload, MatchOption, MeetingType } from "@/types/events";

interface EventFormModalProps {
  isOpen: boolean;
  matches: MatchOption[];
  initialRecipientId?: string | null;
  initialUsername?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateEventPayload) => Promise<void>;
}

const meetingTypeOptions: { value: MeetingType; label: string }[] = [
  { value: "coffee", label: "Kahve" },
  { value: "dinner", label: "Akşam yemeği" },
  { value: "drinks", label: "İçecek" },
  { value: "walk", label: "Yürüyüş" },
  { value: "movie", label: "Sinema" },
  { value: "activity", label: "Aktivite" },
  { value: "other", label: "Diğer" }
];

const getDefaultStartValue = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return toDatetimeLocal(date);
};

const toDatetimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

const getMatchLabel = (match: MatchOption) => {
  const name = [match.first_name, match.last_name].filter(Boolean).join(" ");
  const username = match.username ? `@${match.username}` : "";
  return [name, username].filter(Boolean).join(" ") || "Eşleşme";
};

const EventFormModal = ({
  isOpen,
  matches,
  initialRecipientId,
  initialUsername,
  isSubmitting = false,
  onClose,
  onSubmit
}: EventFormModalProps) => {
  const [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("coffee");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [description, setDescription] = useState("");
  const [creatorNote, setCreatorNote] = useState("");
  const [error, setError] = useState("");

  const hasInitialRecipientInMatches = useMemo(
    () => Boolean(initialRecipientId && matches.some((match) => match.user_id === initialRecipientId)),
    [initialRecipientId, matches]
  );

  useEffect(() => {
    if (!isOpen) return;

    setError("");
    setRecipientId(initialRecipientId || "");
    setStartsAt((current) => current || getDefaultStartValue());
  }, [isOpen, initialRecipientId]);

  const resetForm = () => {
    setRecipientId(initialRecipientId || "");
    setTitle("");
    setMeetingType("coffee");
    setStartsAt(getDefaultStartValue());
    setEndsAt("");
    setLocationName("");
    setLocationAddress("");
    setDescription("");
    setCreatorNote("");
    setError("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!recipientId) {
      setError("Lütfen davet edeceğiniz kişiyi seçin.");
      return;
    }

    if (!title.trim()) {
      setError("Başlık zorunludur.");
      return;
    }

    if (!startsAt) {
      setError("Başlangıç zamanı zorunludur.");
      return;
    }

    const startDate = new Date(startsAt);
    const endDate = endsAt ? new Date(endsAt) : null;

    if (Number.isNaN(startDate.getTime())) {
      setError("Başlangıç zamanı geçersiz.");
      return;
    }

    if (startDate.getTime() <= Date.now()) {
      setError("Başlangıç zamanı gelecekte olmalıdır.");
      return;
    }

    if (endDate && (Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime())) {
      setError("Bitiş zamanı başlangıçtan sonra olmalıdır.");
      return;
    }

    await onSubmit({
      recipient_id: recipientId,
      title: title.trim(),
      meeting_type: meetingType,
      starts_at: startDate.toISOString(),
      ends_at: endDate ? endDate.toISOString() : null,
      location_name: locationName.trim(),
      location_address: locationAddress.trim(),
      description: description.trim(),
      creator_note: creatorNote.trim()
    });

    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-pink-500/20 bg-[#2C2C2E] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#3C3C3E] bg-[#2C2C2E] p-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Randevu Planla</h2>
            <p className="mt-1 text-sm text-gray-400">Eşleşmeniz için yeni bir etkinlik daveti oluşturun.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-gray-400 transition hover:bg-[#3C3C3E] hover:text-white disabled:opacity-50"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {(initialUsername || (initialRecipientId && !hasInitialRecipientInMatches)) && (
            <div className="rounded-xl border border-pink-500/20 bg-pink-500/10 p-4 text-sm text-pink-100">
              {initialRecipientId ? (
                <span>Seçilen kişi davete hazır. İsterseniz aşağıdan farklı bir eşleşme seçebilirsiniz.</span>
              ) : (
                <span>
                  @{initialUsername} için kullanıcı ID bilgisi alınamadı. Davet göndermek için listeden kullanıcı ID bilgisi bulunan bir eşleşme seçin.
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Kişi *</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
              disabled={isSubmitting}
            >
              <option value="">Eşleşme seçin</option>
              {initialRecipientId && !hasInitialRecipientInMatches && (
                <option value={initialRecipientId}>
                  {initialUsername ? `@${initialUsername}` : "Seçilen kullanıcı"}
                </option>
              )}
              {matches.map((match) => (
                <option key={match.id} value={match.user_id || ""} disabled={!match.user_id}>
                  {getMatchLabel(match)}{!match.user_id ? " (kullanıcı ID yok)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-200">Başlık *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn. Kahve buluşması"
                className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Buluşma tipi *</label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as MeetingType)}
                className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
                disabled={isSubmitting}
              >
                {meetingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Başlangıç *</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                min={toDatetimeLocal(new Date())}
                className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Bitiş</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                min={startsAt || toDatetimeLocal(new Date())}
                className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Mekan adı</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Örn. Moda Sahili"
                className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
                disabled={isSubmitting}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-200">Adres</label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Buluşma adresi"
                className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Plan detayları..."
              rows={3}
              className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-200">Not</label>
            <textarea
              value={creatorNote}
              onChange={(e) => setCreatorNote(e.target.value)}
              placeholder="Davet mesajınız..."
              rows={2}
              className="w-full rounded-lg border border-[#4C4C4E] bg-[#3C3C3E] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-[#D63384] focus:ring-2 focus:ring-[#D63384]/40"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[#3C3C3E] pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-full px-5 py-2.5 text-gray-300 transition hover:bg-[#3C3C3E] hover:text-white disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#D63384] px-6 py-2.5 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Gönderiliyor..." : "Davet Gönder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventFormModal;
