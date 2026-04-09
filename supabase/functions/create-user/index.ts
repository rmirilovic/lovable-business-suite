import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter: max 10 requests per 15 minutes per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Previše zahteva. Pokušajte ponovo later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    const isSuperAdmin = !!roleData;

    // If not super_admin, check if local admin
    let localAdminCompanyIds: string[] = [];
    if (!isSuperAdmin) {
      const { data: localAdminData } = await supabaseAdmin
        .from("user_companies")
        .select("company_id")
        .eq("user_id", requestingUser.id)
        .eq("is_local_admin", true);

      if (localAdminData && localAdminData.length > 0) {
        localAdminCompanyIds = localAdminData.map((d) => d.company_id);
      } else {
        return new Response(
          JSON.stringify({ error: "Nemate ovlašćenja za kreiranje korisnika" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse request body
    const { email, password, first_name, last_name, role, companies } = await req.json();

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
      },
    });

    if (createError) {
      let errorMessage = createError.message;
      
      if (createError.message.includes("already been registered")) {
        errorMessage = "Korisnik sa ovom email adresom već postoji";
      } else if (createError.message.includes("invalid email")) {
        errorMessage = "Neispravna email adresa";
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = userData.user.id;

    // Assign role
    const roleToAssign = (role && role !== "" && isSuperAdmin) ? role : "user";
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: roleToAssign });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    // Assign companies if provided
    if (companies && companies.length > 0) {
      let validCompanies = companies;
      if (!isSuperAdmin) {
        validCompanies = companies.filter((c: { company_id: string }) => 
          localAdminCompanyIds.includes(c.company_id)
        );
        validCompanies = validCompanies.map((c: { company_id: string; is_local_admin: boolean }) => ({
          ...c,
          is_local_admin: false,
        }));
      }

      if (validCompanies.length > 0) {
        const companyAssignments = validCompanies.map((c: { company_id: string; is_local_admin: boolean }) => ({
          user_id: newUserId,
          company_id: c.company_id,
          is_local_admin: c.is_local_admin || false,
        }));

        const { error: companyError } = await supabaseAdmin
          .from("user_companies")
          .insert(companyAssignments);

        if (companyError) {
          console.error("Company assignment error:", companyError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUserId, 
          email: userData.user.email 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
