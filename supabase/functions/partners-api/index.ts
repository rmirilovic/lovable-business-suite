import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PartnerExport {
  code: string;
  name: string;
  legal_status: number;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  pib: string | null;
  mb: string | null;
  activity_code: string | null;
  jbkjs: string | null;
  website: string | null;
  responsible_person: string | null;
  phone: string | null;
  is_customer: boolean;
  is_supplier: boolean;
  is_in_pdv: boolean;
  assigned_to: string | null;
  note: string | null;
  other_data: string | null;
  is_active: boolean;
  payment_priority: number | null;
  group_code: string | null;
  bank_accounts: { account_number: string; sort_order: number }[];
  contacts: {
    contact_name: string;
    position: string | null;
    phone1: string | null;
    phone2: string | null;
    email: string | null;
    note: string | null;
  }[];
}

interface PartnerImport extends PartnerExport {}

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
      console.log(`Exporting partners for company ${companyId}`);

      // Batch fetch all partners (handles >1000 records)
      const BATCH_SIZE = 1000;
      const allPartners: any[] = [];
      let from = 0;

      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from("partners")
          .select("*, partner_groups(code)")
          .eq("company_id", companyId)
          .order("code")
          .range(from, from + BATCH_SIZE - 1);

        if (batchError) {
          console.error("Error fetching partners batch:", batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) break;
        allPartners.push(...batch);
        console.log(`Fetched partners batch: ${from} to ${from + batch.length - 1}`);

        if (batch.length < BATCH_SIZE) break;
        from += BATCH_SIZE;
      }

      console.log(`Total partners fetched: ${allPartners.length}`);

      // Fetch all bank accounts and contacts in batches
      const partnerIds = allPartners.map((p) => p.id);
      
      let bankAccountsMap: Record<string, any[]> = {};
      let contactsMap: Record<string, any[]> = {};

      if (partnerIds.length > 0) {
        // Batch fetch bank accounts
        const allBankAccounts: any[] = [];
        for (let i = 0; i < partnerIds.length; i += BATCH_SIZE) {
          const batchIds = partnerIds.slice(i, i + BATCH_SIZE);
          const { data: bankBatch, error: bankError } = await supabase
            .from("partner_bank_accounts")
            .select("*")
            .in("partner_id", batchIds)
            .order("sort_order");

          if (bankError) {
            console.error("Error fetching bank accounts batch:", bankError);
            throw bankError;
          }
          if (bankBatch) allBankAccounts.push(...bankBatch);
        }

        // Group by partner_id
        bankAccountsMap = allBankAccounts.reduce((acc, ba) => {
          if (!acc[ba.partner_id]) acc[ba.partner_id] = [];
          acc[ba.partner_id].push(ba);
          return acc;
        }, {} as Record<string, any[]>);

        console.log(`Total bank accounts fetched: ${allBankAccounts.length}`);

        // Batch fetch contacts
        const allContacts: any[] = [];
        for (let i = 0; i < partnerIds.length; i += BATCH_SIZE) {
          const batchIds = partnerIds.slice(i, i + BATCH_SIZE);
          const { data: contactsBatch, error: contactsError } = await supabase
            .from("partner_contacts")
            .select("*")
            .in("partner_id", batchIds)
            .order("created_at");

          if (contactsError) {
            console.error("Error fetching contacts batch:", contactsError);
            throw contactsError;
          }
          if (contactsBatch) allContacts.push(...contactsBatch);
        }

        contactsMap = allContacts.reduce((acc, c) => {
          if (!acc[c.partner_id]) acc[c.partner_id] = [];
          acc[c.partner_id].push(c);
          return acc;
        }, {} as Record<string, any[]>);

        console.log(`Total contacts fetched: ${allContacts.length}`);
      }

      // Build export data
      const exportData: PartnerExport[] = allPartners.map((p) => ({
        code: p.code,
        name: p.name,
        legal_status: p.legal_status,
        address: p.address,
        postal_code: p.postal_code,
        city: p.city,
        country: p.country,
        email: p.email,
        pib: p.pib,
        mb: p.mb,
        activity_code: p.activity_code,
        jbkjs: p.jbkjs,
        website: p.website,
        responsible_person: p.responsible_person,
        phone: p.phone,
        is_customer: p.is_customer,
        is_supplier: p.is_supplier,
        is_in_pdv: p.is_in_pdv,
        assigned_to: p.assigned_to,
        note: p.note,
        other_data: p.other_data,
        is_active: p.is_active,
        payment_priority: p.payment_priority,
        group_code: p.partner_groups?.code || null,
        bank_accounts: (bankAccountsMap[p.id] || []).map((ba) => ({
          account_number: ba.account_number,
          sort_order: ba.sort_order,
        })),
        contacts: (contactsMap[p.id] || []).map((c) => ({
          contact_name: c.contact_name,
          position: c.position,
          phone1: c.phone1,
          phone2: c.phone2,
          email: c.email,
          note: c.note,
        })),
      }));

      console.log(`Exported ${exportData.length} partners`);

      return new Response(
        JSON.stringify({
          success: true,
          count: exportData.length,
          data: exportData,
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

      const body = await req.json();
      const partners: PartnerImport[] = body.data;
      const updateExisting = body.update_existing ?? false;

      if (!Array.isArray(partners)) {
        return new Response(
          JSON.stringify({ error: "Invalid data format. Expected { data: [...] }" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Importing ${partners.length} partners, update_existing: ${updateExisting}`);

      // Fetch existing partners by code
      const codes = partners.map((p) => p.code);
      const { data: existingPartners } = await supabase
        .from("partners")
        .select("id, code")
        .eq("company_id", companyId)
        .in("code", codes);

      const existingMap = (existingPartners || []).reduce((acc, p) => {
        acc[p.code] = p.id;
        return acc;
      }, {} as Record<string, string>);

      // Fetch partner groups
      const groupCodes = partners.map((p) => p.group_code).filter(Boolean) as string[];
      const { data: groups } = await supabase
        .from("partner_groups")
        .select("id, code")
        .eq("company_id", companyId)
        .in("code", groupCodes);

      const groupMap = (groups || []).reduce((acc, g) => {
        acc[g.code] = g.id;
        return acc;
      }, {} as Record<string, string>);

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { code: string; error: string }[] = [];

      for (const partner of partners) {
        try {
          const existingId = existingMap[partner.code];

          const partnerData = {
            company_id: companyId,
            code: partner.code,
            name: partner.name,
            legal_status: partner.legal_status ?? 1,
            address: partner.address,
            postal_code: partner.postal_code,
            city: partner.city,
            country: partner.country,
            email: partner.email,
            pib: partner.pib,
            mb: partner.mb,
            activity_code: partner.activity_code,
            jbkjs: partner.jbkjs,
            website: partner.website,
            responsible_person: partner.responsible_person,
            phone: partner.phone,
            is_customer: partner.is_customer ?? true,
            is_supplier: partner.is_supplier ?? false,
            is_in_pdv: partner.is_in_pdv ?? true,
            assigned_to: partner.assigned_to,
            note: partner.note,
            other_data: partner.other_data,
            is_active: partner.is_active ?? true,
            payment_priority: partner.payment_priority ?? 3,
            group_id: partner.group_code ? groupMap[partner.group_code] || null : null,
          };

          let partnerId: string;

          if (existingId) {
            if (updateExisting) {
              const { error: updateError } = await supabase
                .from("partners")
                .update(partnerData)
                .eq("id", existingId);

              if (updateError) throw updateError;

              partnerId = existingId;
              updated++;
            } else {
              skipped++;
              continue;
            }
          } else {
            const { data: newPartner, error: insertError } = await supabase
              .from("partners")
              .insert(partnerData)
              .select("id")
              .single();

            if (insertError) throw insertError;

            partnerId = newPartner.id;
            imported++;
          }

          // Handle bank accounts - delete existing and insert new
          if (partner.bank_accounts && partner.bank_accounts.length > 0) {
            await supabase
              .from("partner_bank_accounts")
              .delete()
              .eq("partner_id", partnerId);

            const bankAccountsData = partner.bank_accounts.map((ba, idx) => ({
              partner_id: partnerId,
              company_id: companyId,
              account_number: ba.account_number,
              sort_order: ba.sort_order ?? idx,
            }));

            const { error: baError } = await supabase
              .from("partner_bank_accounts")
              .insert(bankAccountsData);

            if (baError) {
              console.error(`Error inserting bank accounts for ${partner.code}:`, baError);
            }
          }

          // Handle contacts - delete existing and insert new
          if (partner.contacts && partner.contacts.length > 0) {
            await supabase
              .from("partner_contacts")
              .delete()
              .eq("partner_id", partnerId);

            const contactsData = partner.contacts.map((c) => ({
              partner_id: partnerId,
              company_id: companyId,
              contact_name: c.contact_name,
              position: c.position,
              phone1: c.phone1,
              phone2: c.phone2,
              email: c.email,
              note: c.note,
            }));

            const { error: cError } = await supabase
              .from("partner_contacts")
              .insert(contactsData);

            if (cError) {
              console.error(`Error inserting contacts for ${partner.code}:`, cError);
            }
          }
        } catch (err: any) {
          console.error(`Error processing partner ${partner.code}:`, err);
          errors.push({ code: partner.code, error: err.message });
        }
      }

      console.log(`Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);

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
    console.error("Error in partners-api:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
