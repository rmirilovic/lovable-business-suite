import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface APRCompanyData {
  name: string;
  pib: string;
  mb: string;
  address: string;
  city: string;
  postalCode: string;
  activityCode: string;
}

interface APRSearchResult {
  success: boolean;
  data?: APRCompanyData;
  error?: string;
}

// Use Firecrawl to scrape APR website
async function searchAPRWithFirecrawl(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY not configured");
    return { 
      success: false, 
      error: "Firecrawl konektor nije konfigurisan. Molimo unesite podatke ručno." 
    };
  }

  try {
    console.log(`Searching APR via Firecrawl for ${searchType}: ${searchValue}`);

    const aprUrl = `https://pretraga2.apr.gov.rs/unifiedSearchWeb/Search/Search?SearchString=${searchValue}&Office=0`;
    console.log(`Scraping URL: ${aprUrl}`);

    const tryScrape = async (url: string) => {
      const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["html", "markdown"],
          waitFor: 4000,
          onlyMainContent: false,
        }),
      });

      if (!resp.ok) {
        let errJson: any = null;
        try {
          errJson = await resp.json();
        } catch {
          // ignore
        }
        return { ok: false as const, status: resp.status, errJson };
      }

      const data = await resp.json();
      const html = data.data?.html || data.html || "";
      const markdown = data.data?.markdown || data.markdown || "";
      return { ok: true as const, html, markdown };
    };

    // 1) direct scrape
    const scraped = await tryScrape(aprUrl);

    // 2) fallback: Firecrawl search (APR sometimes redirects in a way Firecrawl scrape rejects)
    if (!scraped.ok) {
      console.error("Firecrawl scrape error:", scraped.errJson);

      const isInvalidRedirect =
        scraped.errJson?.code === "SCRAPE_SITE_ERROR" &&
        String(scraped.errJson?.error || "").includes("ERR_INVALID_REDIRECT");

      if (isInvalidRedirect) {
        console.log("Falling back to Firecrawl search due to invalid redirect...");

        try {
          const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: `site:pretraga2.apr.gov.rs ${searchValue}`,
              limit: 5,
              lang: "sr",
              scrapeOptions: { formats: ["html", "markdown"] },
            }),
          });

          console.log(`Firecrawl search status: ${searchResp.status}`);

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const results: any[] = searchData?.data || [];
            console.log(`Firecrawl search results: ${results.length}`);

            const aprResult = results.find(
              (r) => typeof r?.url === "string" && r.url.includes("pretraga2.apr.gov.rs")
            );

            if (aprResult) {
              const html = aprResult?.html || "";
              const markdown = aprResult?.markdown || "";

              // If search didn't include scraped content, try scraping the found URL.
              if (!html && !markdown && typeof aprResult.url === "string") {
                console.log(`Search returned URL without content, scraping result URL: ${aprResult.url}`);
                const scrapedFromResult = await tryScrape(aprResult.url);
                if (scrapedFromResult.ok) {
                  const companyData = parseAPRContent(
                    scrapedFromResult.html,
                    scrapedFromResult.markdown,
                    searchValue,
                    searchType
                  );
                  if (companyData) {
                    console.log("Successfully parsed company data (search->scrape):", companyData);
                    return { success: true, data: companyData };
                  }
                } else {
                  console.error("Firecrawl scrape (search URL) error:", scrapedFromResult.errJson);
                }
              } else {
                const companyData = parseAPRContent(html, markdown, searchValue, searchType);
                if (companyData) {
                  console.log("Successfully parsed company data (search fallback):", companyData);
                  return { success: true, data: companyData };
                }
              }
            }
          } else {
            let errJson: any = null;
            try {
              errJson = await searchResp.json();
            } catch {
              // ignore
            }
            console.error("Firecrawl search error:", errJson);
          }
        } catch (e) {
          console.error("Firecrawl search request failed:", e);
        }
      }

      return {
        success: false,
        error: "APR servis trenutno nije dostupan. Molimo pokušajte kasnije ili unesite podatke ručno.",
      };
    }

    console.log("Firecrawl scrape success, parsing content...");
    console.log(`HTML length: ${scraped.html.length}, Markdown length: ${scraped.markdown.length}`);

    const companyData = parseAPRContent(scraped.html, scraped.markdown, searchValue, searchType);

    if (companyData) {
      console.log("Successfully parsed company data:", companyData);
      return { success: true, data: companyData };
    }

    return {
      success: false,
      error: "Subjekt sa datim PIB/MB nije pronađen u APR registru",
    };
  } catch (error) {
    console.error("Firecrawl search error:", error);
    return {
      success: false,
      error: "APR servis trenutno nije dostupan. Molimo pokušajte kasnije ili unesite podatke ručno.",
    };
  }
}

function parseAPRContent(
  html: string,
  markdown: string,
  searchValue: string,
  searchType: "pib" | "mb"
): APRCompanyData | null {
  const content = `${markdown}\n${html}`;

  const extract = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      const m = p.exec(content);
      if (m?.[1]) return String(m[1]).trim().replace(/\s+/g, " ");
    }
    return "";
  };

  const name = extract([
    /(?:Пословно име|Naziv|Ime firme|Naziv subjekta)\s*[:\-]\s*([^\n<]{3,})/i,
    /\bNaziv\b\s*\*?\s*[:\-]\s*([^\n<]{3,})/i,
    /<td[^>]*>\s*(?:Пословно име|Naziv)\s*<\/td>\s*<td[^>]*>\s*([^<]{3,})/i,
    /class="[^"]*(?:naziv|name|company)[^"]*"[^>]*>\s*([^<]{3,})/i,
  ]);

  const pibFound = extract([
    /(?:\bPIB\b|\bПИБ\b)\s*[:\-]\s*(\d{9})/i,
    /"pib"\s*:\s*"?(\d{9})"?/i,
  ]);

  const mbFound = extract([
    /(?:\bMB\b|Matični broj|Матични број)\s*[:\-]\s*(\d{8})/i,
    /"(?:mb|maticniBroj)"\s*:\s*"?(\d{8})"?/i,
  ]);

  const address = extract([
    /(?:\bAdresa\b|\bАдреса\b|\bSedište\b|\bSediste\b|\bСедиште\b)\s*[:\-]\s*([^\n<]{3,})/i,
    /<td[^>]*>\s*(?:Адреса|Adresa)\s*<\/td>\s*<td[^>]*>\s*([^<]{3,})/i,
  ]);

  const postalCode =
    extract([
      /(?:\bPB\b|Poštanski broj|Postanski broj|Поштански број)\s*[:\-]\s*(\d{5})/i,
      /\b(\d{5})\b/i,
    ]) || "";

  const city = extract([
    /(?:\bMesto\b|\bМесто\b|\bGrad\b|\bNaselje\b)\s*[:\-]\s*([^\n<]{2,})/i,
    /\b\d{5}\b\s*([^\n<]{2,})/i,
  ]);

  const activityCode = extract([
    /(?:Šifra delatnosti|Sifra delatnosti|Шифра делатности|Delatnost)\s*[:\-]\s*(\d{4,5})/i,
    /"(?:sifradelatnosti|activityCode)"\s*:\s*"?(\d{4,5})"?/i,
  ]);

  const pib = searchType === "pib" ? searchValue : pibFound;
  const mb = searchType === "mb" ? searchValue : mbFound;

  // If we couldn't even get a name, treat as not found.
  if (!name) {
    console.log("Could not find enough company data in scraped content");
    return null;
  }

  return {
    name,
    pib: pib || "",
    mb: mb || "",
    address: address || "",
    city: city || "",
    postalCode: postalCode || "",
    activityCode: activityCode || "",
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchValue, searchType } = await req.json();
    
    console.log(`APR lookup request - type: ${searchType}, value: ${searchValue}`);

    if (!searchValue || !searchType) {
      return new Response(
        JSON.stringify({ success: false, error: "Nedostaju parametri pretrage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const cleanValue = searchValue.replace(/\D/g, "");
    
    if (searchType === "pib" && cleanValue.length !== 9) {
      return new Response(
        JSON.stringify({ success: false, error: "PIB mora imati 9 cifara" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (searchType === "mb" && cleanValue.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Matični broj mora imati 8 cifara" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Firecrawl to search APR
    const result = await searchAPRWithFirecrawl(cleanValue, searchType);

    console.log(`APR lookup result:`, JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      {
        // IMPORTANT: always return 200 for "not found" / "not available" so the client
        // doesn't treat it as a transport error (supabase-js turns non-2xx into error)
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Serverska greška" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
