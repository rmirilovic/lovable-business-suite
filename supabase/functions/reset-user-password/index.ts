import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter: max 5 requests per 15 minutes per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  crypto.getRandomValues(new Uint32Array(length)).forEach((n) => {
    out += chars[n % chars.length];
  });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Previše zahteva. Pokušajte ponovo kasnije." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Niste prijavljeni" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: requestingUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Niste prijavljeni" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.user_id as string | undefined;
    const newPasswordInput = (body?.new_password as string | null | undefined) ?? null;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Nedostaje user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPasswordInput && newPasswordInput.length < 6) {
      return new Response(
        JSON.stringify({ error: "Lozinka mora imati najmanje 6 karaktera" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Super admin?
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    const isSuperAdmin = !!roleData;

    // Prevent local admins from resetting super admin passwords
    if (!isSuperAdmin) {
      const { data: targetSuper } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("role", "super_admin")
        .maybeSingle();

      if (targetSuper) {
        return new Response(JSON.stringify({ error: "Nemate ovlašćenja" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If not super admin, validate company relationship
    if (!isSuperAdmin) {
      const { data: localAdminCompanies } = await supabaseAdmin
        .from("user_companies")
        .select("company_id")
        .eq("user_id", requestingUser.id)
        .eq("is_local_admin", true);

      const localAdminCompanyIds = (localAdminCompanies || []).map((x) => x.company_id);

      if (localAdminCompanyIds.length === 0) {
        return new Response(JSON.stringify({ error: "Nemate ovlašćenja" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetMembership } = await supabaseAdmin
        .from("user_companies")
        .select("id")
        .eq("user_id", targetUserId)
        .in("company_id", localAdminCompanyIds)
        .limit(1)
        .maybeSingle();

      if (!targetMembership) {
        return new Response(JSON.stringify({ error: "Nemate ovlašćenja" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const passwordToSet = newPasswordInput || generateTempPassword(12);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: passwordToSet,
    });

    if (updateError) {
      console.error("Reset password error:", updateError);
      return new Response(JSON.stringify({ error: "Greška pri resetovanju lozinke" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, password: passwordToSet }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
