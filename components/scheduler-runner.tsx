"use client";
import { useEffect } from "react";
export function SchedulerRunner() {
  useEffect(() => {
    let running = false; let cancelled = false;
    async function tick() {
      if (running || cancelled) return; running = true;
      const response = await fetch("/api/scheduler/due", { cache: "no-store" }); const body = await response.json().catch(() => ({}));
      for (const campaign of body.campaigns ?? []) {
        if (cancelled) break;
        for (let index = 0; index < 500; index += 1) {
          const sent = await fetch(`/api/campaigns/${campaign.id}/start`, { method: "POST" }); const result = await sent.json().catch(() => ({}));
          window.dispatchEvent(new Event("queue-updated"));
          if (!sent.ok || result.complete || !result.processed) break;
          if (result.nextDelayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, result.nextDelayMs));
        }
      }
      running = false;
    }
    void tick(); const timer = window.setInterval(tick, 20000); return () => { cancelled = true; window.clearInterval(timer); };
  }, []);
  return null;
}
