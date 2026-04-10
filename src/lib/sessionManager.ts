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

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = "Nepoznat";
  let os = "Nepoznat";
  let deviceType = "Desktop";

  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Firefox";

  const versionMatch = ua.match(new RegExp(`${browser === "Edge" ? "Edg" : browser === "Opera" ? "OPR" : browser}/([\\d.]+)`));
  if (versionMatch) browser += ` ${versionMatch[1].split(".")[0]}`;

  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) {
    const ver = ua.match(/Mac OS X ([\d_]+)/);
    os = ver ? `macOS ${ver[1].replace(/_/g, ".")}` : "macOS";
  }
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  if (ua.includes("Mobi")) deviceType = "Mobilni";
  else if (ua.includes("Tablet") || ua.includes("iPad")) deviceType = "Tablet";

  return { browser, os, deviceType };
}

async function getIpAddress(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return data.ip;
    }
  } catch {
    // Silent fail
  }
  return null;
}

export async function registerSession(companyId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number | null;
}> {
  const token = getOrCreateSessionToken();
  const { browser, os, deviceType } = getDeviceInfo();
  const ipAddress = await getIpAddress();

  const { data, error } = await supabase.rpc("register_session", {
    _company_id: companyId,
    _session_token: token,
    _browser: browser,
    _os: os,
    _device_type: deviceType,
    _ip_address: ipAddress,
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

// Note: When a tab is closed without explicit sign-out, the session will be 
// automatically cleaned up after 10 minutes of no heartbeat by the database functions.
