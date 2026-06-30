import { CreateEventPayload, MatchaEvent } from "@/types/events";

const getEventsBaseUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

  if (!apiUrl) {
    throw new Error("Backend API URL tanımlı değil");
  }

  return `${apiUrl}/events`;
};

const authHeaders = (token: string, hasBody = false): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  ...(hasBody ? { "Content-Type": "application/json" } : {})
});

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    const detail = data?.detail || data?.message || data?.error;

    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg || JSON.stringify(item)).join(", ");
    }
    if (detail) return JSON.stringify(detail);
  } catch {
    // Ignore JSON parse errors and use status text below.
  }

  return `${fallback} (${response.status}${response.statusText ? ` ${response.statusText}` : ""})`;
};

const request = async <T>(token: string, path = "", init?: RequestInit): Promise<T> => {
  const response = await fetch(`${getEventsBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token, Boolean(init?.body)),
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Etkinlik isteği başarısız oldu"));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
};

export const getEvents = (token: string) => request<MatchaEvent[]>(token);

export const createEvent = (token: string, payload: CreateEventPayload) =>
  request<MatchaEvent>(token, "", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const acceptEvent = (token: string, eventId: string | number) =>
  request<MatchaEvent>(token, `/${eventId}/accept`, { method: "POST" });

export const declineEvent = (token: string, eventId: string | number) =>
  request<MatchaEvent>(token, `/${eventId}/decline`, { method: "POST" });

export const cancelEvent = (token: string, eventId: string | number) =>
  request<MatchaEvent>(token, `/${eventId}/cancel`, { method: "POST" });
