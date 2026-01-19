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
    
    // APR unified search URL
    const aprUrl = `https://pretraga2.apr.gov.rs/unifiedSearchWeb/Search/Search?SearchString=${searchValue}&Office=0`;
    
    console.log(`Scraping URL: ${aprUrl}`);
    
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: aprUrl,
        formats: ["html", "markdown"],
        waitFor: 3000, // Wait for dynamic content to load
        onlyMainContent: false,
      }),
    });

    console.log(`Firecrawl response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Firecrawl API error:", errorData);
      return { 
        success: false, 
        error: "Greška pri pristupu APR registru. Pokušajte ponovo ili unesite podatke ručno." 
      };
    }

    const data = await response.json();
    console.log("Firecrawl success, parsing content...");
    
    // Get the HTML and markdown content
    const html = data.data?.html || data.html || "";
    const markdown = data.data?.markdown || data.markdown || "";
    
    console.log(`HTML length: ${html.length}, Markdown length: ${markdown.length}`);
    
    // Parse the scraped content
    const companyData = parseAPRContent(html, markdown, searchValue, searchType);
    
    if (companyData) {
      console.log("Successfully parsed company data:", companyData);
      return { success: true, data: companyData };
    }

    return { 
      success: false, 
      error: "Subjekt sa datim PIB/MB nije pronađen u APR registru" 
    };
  } catch (error) {
    console.error("Firecrawl search error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Greška pri pretrazi APR registra" 
    };
  }
}

function parseAPRContent(html: string, markdown: string, searchValue: string, searchType: "pib" | "mb"): APRCompanyData | null {
  const content = html + " " + markdown;
  
  // Try to extract company information using various patterns
  let name = "";
  let pib = searchType === "pib" ? searchValue : "";
  let mb = searchType === "mb" ? searchValue : "";
  let address = "";
  let city = "";
  let postalCode = "";
  let activityCode = "";

  // Look for name patterns (Serbian and Latin)
  const namePatterns = [
    /(?:Пословно име|Naziv|Ime firme|Naziv subjekta)[:\s]*([^\n<]+)/gi,
    /(?:Firma|Preduzeće|Privredno društvo)[:\s]*([^\n<]+)/gi,
    /<td[^>]*>\s*(?:Пословно име|Naziv)\s*<\/td>\s*<td[^>]*>\s*([^<]+)/gi,
    /class="[^"]*(?:naziv|name|company)[^"]*"[^>]*>([^<]+)</gi,
  ];
  
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      name = match[1].trim().replace(/\s+/g, " ");
      if (name.length > 100) continue; // Skip if too long (probably matched wrong element)
      break;
    }
  }

  // Extract PIB if not provided
  if (!pib) {
    const pibPatterns = [
      /(?:ПИБ|PIB)[:\s]*(\d{9})/gi,
      />\s*(\d{9})\s*</g,
    ];
    for (const pattern of pibPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        pib = match[1];
        break;
      }
    }
  }

  // Extract MB if not provided
  if (!mb) {
    const mbPatterns = [
      /(?:Матични број|MB|Maticni broj)[:\s]*(\d{8})/gi,
      />\s*(\d{8})\s*</g,
    ];
    for (const pattern of mbPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        mb = match[1];
        break;
      }
    }
  }

  // Extract address
  const addressPatterns = [
    /(?:Седиште|Adresa|Sedište)[:\s]*([^\n<,]+(?:,[^\n<]+)?)/gi,
    /<td[^>]*>\s*(?:Адреса|Adresa)\s*<\/td>\s*<td[^>]*>\s*([^<]+)/gi,
  ];
  for (const pattern of addressPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].trim().length > 3) {
      address = match[1].trim();
      break;
    }
  }

  // Extract city
  const cityPatterns = [
    /(?:Место|Mesto|Grad|Naselje)[:\s]*([^\n<,]+)/gi,
    /,\s*(\d{5})\s*([^,\n<]+)/g,
  ];
  for (const pattern of cityPatterns) {
    const match = content.match(pattern);
    if (match) {
      if (match[2]) {
        // Pattern with postal code
        postalCode = match[1];
        city = match[2].trim();
      } else if (match[1]) {
        city = match[1].trim();
      }
      break;
    }
  }

  // Extract postal code
  if (!postalCode) {
    const postalPatterns = [
      /(?:Поштански број|Postanski broj|PTT|PAK)[:\s]*(\d{5})/gi,
      /(\d{5})\s+(?:Beograd|Novi Sad|Niš|Kragujevac|Subotica)/gi,
    ];
    for (const pattern of postalPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        postalCode = match[1];
        break;
      }
    }
  }

  // Extract activity code
  const activityPatterns = [
    /(?:Шифра делатности|Sifra delatnosti|Delatnost)[:\s]*(\d{4,5})/gi,
    /(\d{4})\s*-\s*[A-Za-zČĆŽŠĐ]/g,
  ];
  for (const pattern of activityPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      activityCode = match[1];
      break;
    }
  }

  // Need at least a name or both identifiers to consider it valid
  if (!name && !(pib && mb)) {
    console.log("Could not find enough company data in scraped content");
    return null;
  }

  return {
    name: name || "",
    pib,
    mb,
    address,
    city,
    postalCode,
    activityCode,
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
        status: result.success ? 200 : 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
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
