import { API_URL } from "../config";

// Best-effort notification stream. Tries fetch-streaming SSE first
// (works on web + RN with Hermes engine); falls back to long-polling
// if streaming isn't supported or the connection drops.
//
// The handler is called with the parsed notification on each SSE event.
// In poll-mode (fallback) the handler is called with `{ poll: true }`
// so the caller can refresh /notifications/unread-count themselves.

export interface SseHandler {
  onNotification: (n: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export const openNotificationStream = (
  token: string,
  handler: SseHandler
): (() => void) => {
  let cancelled = false;
  let pollInterval: any = null;
  let abortController: AbortController | null = null;
  let reconnectTimer: any = null;

  const startPolling = () => {
    if (pollInterval) return;
    pollInterval = setInterval(() => {
      if (!cancelled) handler.onNotification({ poll: true });
    }, 30_000);
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  const parseBlock = (block: string) => {
    const lines = block.split("\n");
    let event = "message";
    let data = "";
    for (const line of lines) {
      if (line.startsWith(":")) continue; // comment / heartbeat
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (event === "notification" && data) {
      try {
        handler.onNotification(JSON.parse(data));
      } catch {
        /* ignore malformed */
      }
    }
  };

  const tryStream = async () => {
    try {
      abortController = new AbortController();
      const res = await fetch(`${API_URL}/sse/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: abortController.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE failed (${res.status})`);
      }
      // RN fetch body may be a ReadableStream (Hermes) or undefined.
      const body: any = res.body;
      if (!body || typeof body.getReader !== "function") {
        throw new Error("fetch streaming not supported");
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      handler.onConnected?.();
      stopPolling();
      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          parseBlock(block);
        }
      }
      handler.onDisconnected?.();
      // Connection ended cleanly — try to reconnect after a short delay.
      if (!cancelled) {
        reconnectTimer = setTimeout(tryStream, 5_000);
      }
    } catch (err) {
      handler.onDisconnected?.();
      if (cancelled) return;
      // Stream failed — start polling and retry SSE in 30s.
      startPolling();
      reconnectTimer = setTimeout(tryStream, 30_000);
    }
  };

  tryStream();

  return () => {
    cancelled = true;
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        /* ignore */
      }
    }
    if (reconnectTimer) clearTimeout(reconnectTimer);
    stopPolling();
  };
};
