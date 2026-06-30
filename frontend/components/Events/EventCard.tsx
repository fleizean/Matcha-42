import { FiCalendar, FiClock, FiMapPin, FiUser } from "react-icons/fi";
import { MatchaEvent, EventParticipant } from "@/types/events";
import EventStatusBadge from "./EventStatusBadge";

interface EventCardProps {
  event: MatchaEvent;
  currentUserId?: string | null;
  onAccept: (eventId: string | number) => void;
  onDecline: (eventId: string | number) => void;
  onCancel: (eventId: string | number) => void;
  actionLoading?: string | number | null;
}

const meetingTypeLabels: Record<string, string> = {
  coffee: "Kahve",
  dinner: "Akşam yemeği",
  drinks: "İçecek",
  walk: "Yürüyüş",
  movie: "Sinema",
  activity: "Aktivite",
  other: "Diğer"
};

const getParticipantId = (participant?: EventParticipant) =>
  participant?.user_id || participant?.id;

const getName = (participant?: EventParticipant) => {
  if (!participant) return "Eşleşme";
  if (participant.name) return participant.name;

  const fullName = [participant.first_name, participant.last_name].filter(Boolean).join(" ");
  return fullName || participant.username || "Eşleşme";
};

const idsEqual = (left?: string | null, right?: string | null) =>
  Boolean(left && right && String(left) === String(right));

const buildName = (
  firstName?: string | null,
  lastName?: string | null,
  username?: string | null
) => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return fullName || username || "Eşleşme";
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const EventCard = ({
  event,
  currentUserId,
  onAccept,
  onDecline,
  onCancel,
  actionLoading
}: EventCardProps) => {
  const status = String(event.status || "").toLowerCase();
  const creatorId = event.creator_id || event.creator_user_id || getParticipantId(event.creator);
  const recipientId = event.recipient_id || event.recipient_user_id || getParticipantId(event.recipient);
  const isRecipient = idsEqual(currentUserId, recipientId);
  const isCreator = idsEqual(currentUserId, creatorId);
  const isParticipant = Boolean(
    isRecipient ||
    isCreator ||
    event.participants?.some((participant) => idsEqual(currentUserId, getParticipantId(participant)))
  );
  const otherParticipant =
    event.matched_participant ||
    event.participant ||
    (isRecipient ? event.creator : event.recipient) ||
    event.participants?.find((participant) => !idsEqual(currentUserId, getParticipantId(participant)));
  const otherName = otherParticipant
    ? getName(otherParticipant)
    : isRecipient
      ? buildName(event.creator_first_name, event.creator_last_name, event.creator_username)
      : buildName(event.recipient_first_name, event.recipient_last_name, event.recipient_username);
  const otherUsername = otherParticipant?.username || (isRecipient ? event.creator_username : event.recipient_username);
  const canRespond = isRecipient && status === "pending";
  const canCancel = isParticipant && ["pending", "accepted"].includes(status);
  const isLoading = actionLoading === event.id;

  return (
    <article className="rounded-2xl border border-[#3C3C3E] bg-[#2C2C2E] p-5 shadow-lg shadow-black/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {event.meeting_type && (
              <span className="rounded-full bg-[#3C3C3E] px-3 py-1 text-xs text-gray-300">
                {meetingTypeLabels[String(event.meeting_type)] || event.meeting_type}
              </span>
            )}
          </div>
          <h3 className="text-xl font-semibold text-white">{event.title}</h3>
          <div className="mt-2 flex items-center text-sm text-gray-300">
            <FiUser className="mr-2 text-[#D63384]" />
            <span>{otherName}</span>
            {otherUsername && (
              <span className="ml-2 text-gray-500">@{otherUsername}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canRespond && (
            <>
              <button
                type="button"
                onClick={() => onAccept(event.id)}
                disabled={isLoading}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kabul Et
              </button>
              <button
                type="button"
                onClick={() => onDecline(event.id)}
                disabled={isLoading}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reddet
              </button>
            </>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel(event.id)}
              disabled={isLoading}
              className="rounded-full bg-[#3C3C3E] px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-[#4C4C4E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              İptal Et
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-gray-300 sm:grid-cols-2">
        <div className="flex items-center">
          <FiCalendar className="mr-2 text-[#D63384]" />
          <span>{formatDateTime(event.starts_at)}</span>
        </div>
        {event.ends_at && (
          <div className="flex items-center">
            <FiClock className="mr-2 text-[#D63384]" />
            <span>Bitiş: {formatDateTime(event.ends_at)}</span>
          </div>
        )}
        {(event.location_name || event.location_address) && (
          <div className="flex items-start sm:col-span-2">
            <FiMapPin className="mr-2 mt-0.5 flex-shrink-0 text-[#D63384]" />
            <span>
              {event.location_name}
              {event.location_name && event.location_address ? " · " : ""}
              {event.location_address}
            </span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="mt-4 rounded-xl bg-[#3C3C3E]/60 p-4 text-sm leading-relaxed text-gray-300">
          {event.description}
        </p>
      )}
    </article>
  );
};

export default EventCard;
