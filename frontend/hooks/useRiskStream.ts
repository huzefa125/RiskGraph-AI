"use client";

import { useEffect, useState } from "react";
import type { RiskStreamEvent } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws/risk-stream";

export type StreamStatus = "LIVE" | "RECONNECTING" | "OFFLINE";

const MAX_EVENTS = 20;
const RECONNECT_DELAY_MS = 2000;
// after this many consecutive failed attempts, surface OFFLINE instead of RECONNECTING —
// still keeps retrying underneath, just tells the user the server looks down, not just slow
const OFFLINE_AFTER_ATTEMPTS = 3;

export function useRiskStream() {
  const [events, setEvents] = useState<RiskStreamEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("RECONNECTING");

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function connect() {
      if (cancelled) return;
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        attempts = 0;
        setStatus("LIVE");
      };

      socket.onmessage = (event) => {
        try {
          const parsed: RiskStreamEvent = JSON.parse(event.data);
          setEvents((prev) => [parsed, ...prev].slice(0, MAX_EVENTS));
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        attempts += 1;
        setStatus(attempts >= OFFLINE_AFTER_ATTEMPTS ? "OFFLINE" : "RECONNECTING");
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return { events, status };
}
