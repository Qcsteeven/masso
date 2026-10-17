import { api } from "../../api/client";

/** Opens a session WebSocket with a short-lived token from POST /api/sessions/{id}/ws-token. */
export async function openSessionSocket(sessionId: string, channel: "events" | "terminal"): Promise<WebSocket> {
  const { token } = await api.post<{ token: string }>(`/api/sessions/${sessionId}/ws-token`);
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${proto}//${window.location.host}/ws/sessions/${sessionId}/${channel}?token=${encodeURIComponent(token)}`);
}
