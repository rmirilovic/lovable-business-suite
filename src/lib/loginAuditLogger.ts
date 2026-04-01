import { supabase } from "@/integrations/supabase/client";

function parseUserAgent(ua: string) {
  let browser = "Nepoznat";
  let os = "Nepoznat";
  let deviceType = "Desktop";

  // Browser detection
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox/")) browser = "Firefox";

  // Extract version
  const versionMatch = ua.match(new RegExp(`${browser === "Edge" ? "Edg" : browser === "Opera" ? "OPR" : browser}/([\\d.]+)`));
  if (versionMatch) browser += ` ${versionMatch[1].split(".")[0]}`;

  // OS detection
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X")) {
    const ver = ua.match(/Mac OS X ([\d_]+)/);
    os = ver ? `macOS ${ver[1].replace(/_/g, ".")}` : "macOS";
  }
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  // Device type
  if (ua.includes("Mobi")) deviceType = "Mobilni";
  else if (ua.includes("Tablet") || ua.includes("iPad")) deviceType = "Tablet";

  return { browser, os, deviceType };
}

export async function recordLoginAudit(
  userId: string,
  userEmail: string | undefined,
  userName: string | undefined,
  companyId?: string,
  companyName?: string
) {
  try {
    const ua = navigator.userAgent;
    const { browser, os, deviceType } = parseUserAgent(ua);
    const screenResolution = `${window.screen.width}x${window.screen.height}`;
    const locale = navigator.language || "sr-Latn";

    // Try to get IP address
    let ipAddress: string | null = null;
    try {
      const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        ipAddress = data.ip;
      }
    } catch {
      // IP lookup failed, continue without it
    }

    await (supabase as any).from("login_audit_log").insert({
      user_id: userId,
      user_email: userEmail || null,
      user_name: userName || null,
      company_id: companyId || null,
      company_name: companyName || null,
      browser,
      os,
      device_type: deviceType,
      screen_resolution: screenResolution,
      locale,
      ip_address: ipAddress,
      user_agent: ua,
    });
  } catch (error) {
    console.error("Failed to record login audit:", error);
  }
}

export async function updateLoginAuditCompany(
  userId: string,
  companyId: string,
  companyName: string
) {
  try {
    // Find the most recent audit entry for this user that has no company set
    const { data: recent } = await (supabase as any)
      .from("login_audit_log")
      .select("id")
      .eq("user_id", userId)
      .is("company_id", null)
      .order("login_at", { ascending: false })
      .limit(1)
      .single();

    if (recent?.id) {
      await (supabase as any)
        .from("login_audit_log")
        .update({ company_id: companyId, company_name: companyName })
        .eq("id", recent.id);
    }
  } catch {
    // Silent fail - don't disrupt UX
  }
}