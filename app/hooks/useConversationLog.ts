import { useCallback, useRef } from "react";
import { appendLine, ConversationRole } from "@/app/lib/history/history-store";
import { getSettings } from "@/app/lib/config/settings-store";

/**
 * Records conversation lines into the local history store, one session per
 * mount. No-ops while Recording History is disabled in Settings. The session
 * row is created lazily on the first recorded line.
 */
export function useConversationLog() {
  const sessionRef = useRef<{ id: string; startedAt: number } | null>(null);

  const record = useCallback((role: ConversationRole, text: string) => {
    if (!getSettings().recordingHistory) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (!sessionRef.current) {
      sessionRef.current = { id: `c_${now}_${Math.round(now % 1e6)}`, startedAt: now };
    }
    appendLine(sessionRef.current, { role, text: trimmed, at: now });
  }, []);

  return { record };
}
