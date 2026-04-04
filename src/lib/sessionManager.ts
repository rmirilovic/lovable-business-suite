import { supabase } from "@/integrations/supabase/client";

const SESSION_TOKEN_KEY = "erp.sessionToken";
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

let heartbeatInterval: number | null = null;

function getOrCreateSessionToken(): string {
  let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export async function checkSessionLimit(companyId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number | null;
}> {
  const { data, error } = await supabase.rpc("check_session_limit", {
    _company_id: companyId,
    _user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
  });

  if (error) {
    console.error("Failed to check session limit:", error);
    return { allowed: true, current: 0, max: null };
  }

  return data as { allowed: boolean; current: number; max: number | null };
}

export async function registerSession(companyId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number | null;
}> {
  const token = getOrCreateSessionToken();

  const { data, error } = await supabase.rpc("register_session", {
    _company_id: companyId,
    _session_token: token,
  });

  if (error) {
    console.error("Failed to register session:", error);
    return { allowed: true, current: 0, max: null };
  }

  const result = data as { allowed: boolean; current: number; max: number | null };

  if (result.allowed) {
    startHeartbeat();
  }

  return result;
}

export async function removeSession(): Promise<void> {
  const token = getSessionToken();
  if (!token) return;

  stopHeartbeat();

  try {
    await supabase.rpc("remove_session", { _session_token: token });
  } catch {
    // Silent fail
  }

  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

function startHeartbeat() {
  stopHeartbeat();

  const token = getSessionToken();
  if (!token) return;

  heartbeatInterval = window.setInterval(async () => {
    const currentToken = getSessionToken();
    if (!currentToken) {
      stopHeartbeat();
      return;
    }

    try {
      await supabase.rpc("heartbeat_session", { _session_token: currentToken });
    } catch {
      // Silent fail
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    window.clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Re-start heartbeat if we already have a session token (page reload)
export function resumeHeartbeatIfNeeded() {
  const token = getSessionToken();
  if (token) {
    startHeartbeat();
  }
}

// Clean up session on tab/window close
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    const token = getSessionToken();
    if (token) {
      // Use sendBeacon for reliable cleanup on tab close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/remove_session`;
      const body = JSON.stringify({ _session_token: token });
      navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" })
      );
    }
  });
}
