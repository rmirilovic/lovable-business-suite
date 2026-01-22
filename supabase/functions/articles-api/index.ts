import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ArticleExport {
  code: string;
  name: string;
  article_group: string | null;
  unit: string;
  purchase_price: number | null;
  selling_price: number | null;
  stock: number | null;
  min_stock: number | null;
  is_active: boolean;
  svk: string | null;
  kg_po_jm: number | null;
  kol_mas: number | null;
  attributes: {
    attribute_code: string;
    value: string;
  }[];
}

interface ArticleImport extends ArticleExport {}

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
    const businessYearId = url.searchParams.get("business_year_id");

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "company_id parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!businessYearId) {
      return new Response(
        JSON.stringify({ error: "business_year_id parameter is required" }),
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
      console.log(`Exporting articles for company ${companyId}, year ${businessYearId}`);

      // Batch fetch all articles (handles >1000 records)
      const BATCH_SIZE = 1000;
      const allArticles: any[] = [];
      let from = 0;

      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from("articles")
          .select("*")
          .eq("company_id", companyId)
          .eq("business_year_id", businessYearId)
          .order("code")
          .range(from, from + BATCH_SIZE - 1);

        if (batchError) {
          console.error("Error fetching articles batch:", batchError);
          throw batchError;
        }

        if (!batch || batch.length === 0) break;
        allArticles.push(...batch);
        console.log(`Fetched articles batch: ${from} to ${from + batch.length - 1}`);

        if (batch.length < BATCH_SIZE) break;
        from += BATCH_SIZE;
      }

      console.log(`Total articles fetched: ${allArticles.length}`);

      // Fetch all attribute assignments in batches
      // Note: .in() has URL size limits with many UUIDs, so we use smaller batches
      const articleIds = allArticles.map((a) => a.id);
      const IN_BATCH_SIZE = 100; // Smaller batch for .in() queries to avoid URL size limits
      
      let attributesMap: Record<string, any[]> = {};

      if (articleIds.length > 0) {
        // Batch fetch attribute assignments with smaller batch size for .in()
        const allAssignments: any[] = [];
        for (let i = 0; i < articleIds.length; i += IN_BATCH_SIZE) {
          const batchIds = articleIds.slice(i, i + IN_BATCH_SIZE);
          const { data: assignmentsBatch, error: assignmentsError } = await supabase
            .from("article_attribute_assignments")
            .select("*, article_attributes(code)")
            .in("article_id", batchIds);

          if (assignmentsError) {
            console.error(`Error fetching attribute assignments batch ${i}:`, assignmentsError);
            throw assignmentsError;
          }
          if (assignmentsBatch) allAssignments.push(...assignmentsBatch);
        }

        // Group by article_id
        attributesMap = allAssignments.reduce((acc, aa) => {
          if (!acc[aa.article_id]) acc[aa.article_id] = [];
          acc[aa.article_id].push(aa);
          return acc;
        }, {} as Record<string, any[]>);

        console.log(`Total attribute assignments fetched: ${allAssignments.length}`);
      }

      // Build export data
      const exportData: ArticleExport[] = allArticles.map((a) => ({
        code: a.code,
        name: a.name,
        article_group: a.article_group,
        unit: a.unit,
        purchase_price: a.purchase_price,
        selling_price: a.selling_price,
        stock: a.stock,
        min_stock: a.min_stock,
        is_active: a.is_active ?? true,
        svk: a.svk,
        kg_po_jm: a.kg_po_jm,
        kol_mas: a.kol_mas,
        attributes: (attributesMap[a.id] || []).map((aa) => ({
          attribute_code: aa.article_attributes?.code || "",
          value: aa.value,
        })),
      }));

      console.log(`Exported ${exportData.length} articles`);

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
      const articles: ArticleImport[] = body.data;
      const updateExisting = body.update_existing ?? false;

      if (!Array.isArray(articles)) {
        return new Response(
          JSON.stringify({ error: "Invalid data format. Expected { data: [...] }" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Importing ${articles.length} articles, update_existing: ${updateExisting}`);

      // Fetch existing articles by code
      const codes = articles.map((a) => a.code);
      const { data: existingArticles } = await supabase
        .from("articles")
        .select("id, code")
        .eq("company_id", companyId)
        .eq("business_year_id", businessYearId)
        .in("code", codes);

      const existingMap = (existingArticles || []).reduce((acc, a) => {
        acc[a.code] = a.id;
        return acc;
      }, {} as Record<string, string>);

      // Fetch article attributes for this company
      const attributeCodes = articles.flatMap((a) => a.attributes?.map((attr) => attr.attribute_code) || []).filter(Boolean);
      const uniqueAttributeCodes = [...new Set(attributeCodes)];
      
      let attributeMap: Record<string, string> = {};
      if (uniqueAttributeCodes.length > 0) {
        const { data: attributes } = await supabase
          .from("article_attributes")
          .select("id, code")
          .eq("company_id", companyId)
          .in("code", uniqueAttributeCodes);

        attributeMap = (attributes || []).reduce((acc, attr) => {
          acc[attr.code] = attr.id;
          return acc;
        }, {} as Record<string, string>);
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors: { code: string; error: string }[] = [];

      for (const article of articles) {
        try {
          const existingId = existingMap[article.code];

          const articleData = {
            company_id: companyId,
            business_year_id: businessYearId,
            code: article.code,
            name: article.name,
            article_group: article.article_group,
            unit: article.unit || "kom",
            purchase_price: article.purchase_price ?? 0,
            selling_price: article.selling_price ?? 0,
            stock: article.stock ?? 0,
            min_stock: article.min_stock ?? 0,
            is_active: article.is_active ?? true,
            svk: article.svk,
            kg_po_jm: article.kg_po_jm,
            kol_mas: article.kol_mas,
          };

          let articleId: string;

          if (existingId) {
            if (updateExisting) {
              const { error: updateError } = await supabase
                .from("articles")
                .update(articleData)
                .eq("id", existingId);

              if (updateError) throw updateError;

              articleId = existingId;
              updated++;
            } else {
              skipped++;
              continue;
            }
          } else {
            const { data: newArticle, error: insertError } = await supabase
              .from("articles")
              .insert(articleData)
              .select("id")
              .single();

            if (insertError) throw insertError;

            articleId = newArticle.id;
            imported++;
          }

          // Handle attributes - delete existing and insert new
          if (article.attributes && article.attributes.length > 0) {
            await supabase
              .from("article_attribute_assignments")
              .delete()
              .eq("article_id", articleId);

            const attributeAssignments = article.attributes
              .filter((attr) => attributeMap[attr.attribute_code])
              .map((attr) => ({
                article_id: articleId,
                company_id: companyId,
                attribute_id: attributeMap[attr.attribute_code],
                value: attr.value,
              }));

            if (attributeAssignments.length > 0) {
              const { error: attrError } = await supabase
                .from("article_attribute_assignments")
                .insert(attributeAssignments);

              if (attrError) {
                console.error(`Error inserting attributes for ${article.code}:`, attrError);
              }
            }
          }
        } catch (err: any) {
          console.error(`Error processing article ${article.code}:`, err);
          errors.push({ code: article.code, error: err.message });
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
    console.error("Error in articles-api:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
