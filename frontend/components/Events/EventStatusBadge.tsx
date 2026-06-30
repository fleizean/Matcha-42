import { EventStatus } from "@/types/events";

interface EventStatusBadgeProps {
  status: EventStatus | string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Bekliyor",
    className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
  },
  accepted: {
    label: "Onaylandı",
    className: "border-green-500/40 bg-green-500/10 text-green-300"
  },
  declined: {
    label: "Reddedildi",
    className: "border-red-500/40 bg-red-500/10 text-red-300"
  },
  cancelled: {
    label: "İptal Edildi",
    className: "border-gray-500/40 bg-gray-500/10 text-gray-300"
  },
  completed: {
    label: "Tamamlandı",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-300"
  },
  past: {
    label: "Geçmiş",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-300"
  }
};

const EventStatusBadge = ({ status }: EventStatusBadgeProps) => {
  const config = statusConfig[String(status).toLowerCase()] || {
    label: status || "Bilinmiyor",
    className: "border-gray-500/40 bg-gray-500/10 text-gray-300"
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
};

export default EventStatusBadge;
