export type EventStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed" | "expired" | "past";

export type MeetingType = "coffee" | "dinner" | "drinks" | "walk" | "movie" | "activity" | "custom" | "other";

export interface EventPicture {
  id?: number;
  profile_id?: string;
  file_path?: string;
  backend_url?: string;
  is_primary?: boolean;
  created_at?: string;
}

export interface EventParticipant {
  id?: string;
  user_id?: string;
  profile_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  pictures?: EventPicture[];
  avatar?: string;
}

export interface MatchOption extends EventParticipant {
  id: string;
  user_id: string;
  is_online?: boolean;
  last_online?: string;
}

export interface MatchaEvent {
  id: string | number;
  title: string;
  status: EventStatus | string;
  meeting_type?: MeetingType | string;
  starts_at: string;
  ends_at?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  description?: string | null;
  creator_note?: string | null;
  creator_id?: string;
  recipient_id?: string;
  creator_user_id?: string;
  recipient_user_id?: string;
  creator_username?: string | null;
  recipient_username?: string | null;
  creator_first_name?: string | null;
  recipient_first_name?: string | null;
  creator_last_name?: string | null;
  recipient_last_name?: string | null;
  creator?: EventParticipant;
  recipient?: EventParticipant;
  participant?: EventParticipant;
  matched_participant?: EventParticipant;
  participants?: EventParticipant[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateEventPayload {
  recipient_id: string;
  title: string;
  meeting_type: MeetingType | string;
  starts_at: string;
  ends_at?: string | null;
  location_name?: string;
  location_address?: string;
  description?: string;
  creator_note?: string;
}

export interface CurrentUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}
