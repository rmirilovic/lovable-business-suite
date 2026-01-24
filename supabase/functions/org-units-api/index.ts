import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrgUnitExport {
  code: string;
  name: string;
  parent_code: string | null;
  is_active: boolean;
}

interface ImportData {
  organizational_units?: OrgUnitExport[];
  data?: OrgUnitExport[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id");

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "company_id parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify company access
    const { data: hasAccess } = await supabase.rpc("has_company_access", {
      _user_id: user.id,
      _company_id: companyId,
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied to this company" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EXPORT - GET request
    if (req.method === "GET") {
      console.log(`Exporting organizational units for company ${companyId}`);

      // Batch fetch all units (handles >1000 records)
      const BATCH_SIZE = 1000;
      const allUnits: any[] = [];
      let from = 0;

      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from("organizational_units")
          .select("*")
          .eq("company_id", companyId)
          .order("code")
          .range(from, from + BATCH_SIZE - 1);

        if (batchError) {
          console.error("Error fetching organizational units batch:", batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) break;
        allUnits.push(...batch);
        console.log(`Fetched organizational units batch: ${from} to ${from + batch.length - 1}`);

        if (batch.length < BATCH_SIZE) break;
        from += BATCH_SIZE;
      }

      console.log(`Total organizational units fetched: ${allUnits.length}`);

      // Build export data
      const unitsExport: OrgUnitExport[] = allUnits.map((u) => ({
        code: u.code,
        name: u.name,
        parent_code: u.parent_code,
        is_active: u.is_active ?? true,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          count: unitsExport.length,
          data: {
            organizational_units: unitsExport,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IMPORT - POST request
    if (req.method === "POST") {
      // Check if user is admin
      const { data: isSuperAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "super_admin",
      });

      const { data: isLocalAdmin } = await supabase.rpc("is_local_admin_for_company", {
        _user_id: user.id,
        _company_id: companyId,
      });

      if (!isSuperAdmin && !isLocalAdmin) {
        return new Response(
          JSON.stringify({ error: "Admin access required for import" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body: ImportData = await req.json();
      const updateExisting = (body as any).update_existing ?? false;
      
      // Support both formats: { organizational_units } and { data }
      const units: OrgUnitExport[] = body.organizational_units || body.data || [];

      if (!Array.isArray(units)) {
        return new Response(
          JSON.stringify({ error: "Invalid data format. Expected { organizational_units: [...] } or { data: [...] }" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Importing ${units.length} organizational units, update_existing: ${updateExisting}`);

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { code: string; error: string }[] = [];

      if (units.length > 0) {
        // Fetch existing units by code
        const codes = units.map((u) => u.code);
        const { data: existingUnits } = await supabase
          .from("organizational_units")
          .select("id, code")
          .eq("company_id", companyId)
          .in("code", codes);

        const existingMap = (existingUnits || []).reduce((acc, u) => {
          acc[u.code] = u.id;
          return acc;
        }, {} as Record<string, string>);

        // Sort units by hierarchy level (parent_code null first)
        const sortedUnits = [...units].sort((a, b) => {
          if (!a.parent_code && b.parent_code) return -1;
          if (a.parent_code && !b.parent_code) return 1;
          return 0;
        });

        for (const unit of sortedUnits) {
          try {
            const existingId = existingMap[unit.code];

            const unitData = {
              company_id: companyId,
              code: unit.code,
              name: unit.name,
              parent_code: unit.parent_code,
              is_active: unit.is_active ?? true,
            };

            if (existingId) {
              if (updateExisting) {
                const { error: updateError } = await supabase
                  .from("organizational_units")
                  .update({ 
                    name: unit.name, 
                    parent_code: unit.parent_code,
                    is_active: unit.is_active ?? true,
                  })
                  .eq("id", existingId);

                if (updateError) throw updateError;
                updated++;
              } else {
                skipped++;
              }
            } else {
              const { error: insertError } = await supabase
                .from("organizational_units")
                .insert(unitData);

              if (insertError) throw insertError;
              imported++;
              existingMap[unit.code] = unit.code;
            }
          } catch (err: any) {
            console.error(`Error processing organizational unit ${unit.code}:`, err);
            errors.push({ code: unit.code, error: err.message });
          }
        }

        console.log(`Organizational units: ${imported} imported, ${updated} updated, ${skipped} skipped`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          imported,
          updated,
          skipped,
          errors,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in org-units-api:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
