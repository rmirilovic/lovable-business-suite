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
  activityName: string;
  legalForm: string;
  status: string;
}

interface APRSearchResult {
  success: boolean;
  data?: APRCompanyData;
  error?: string;
}

async function searchAPR(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  try {
    console.log(`Searching APR for ${searchType}: ${searchValue}`);
    
    // APR public search URL
    const searchUrl = `https://pretraga2.apr.gov.rs/unifiedSearchWeb/Search/Search`;
    
    // First, get the search results page
    const searchParams = new URLSearchParams({
      SearchString: searchValue,
      Office: "0", // All offices
    });
    
    const searchResponse = await fetch(`${searchUrl}?${searchParams}`, {
      method: "GET",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sr-RS,sr;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!searchResponse.ok) {
      console.log(`APR search failed with status: ${searchResponse.status}`);
      throw new Error("APR pretraga nije dostupna");
    }

    const html = await searchResponse.text();
    console.log(`Received HTML response, length: ${html.length}`);
    
    // Try to parse the response for company data
    // APR returns HTML with company details
    const companyData = parseAPRResponse(html, searchValue, searchType);
    
    if (companyData) {
      return { success: true, data: companyData };
    }
    
    // If no direct match, try the unified API
    return await searchAPRUnifiedAPI(searchValue, searchType);
  } catch (error) {
    console.error("APR search error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Greška pri pretrazi APR registra" 
    };
  }
}

async function searchAPRUnifiedAPI(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  try {
    // Alternative: Use the APR unified search API endpoint
    const apiUrl = "https://pretraga2.apr.gov.rs/APRWebPublish/APRUnifiedSearch/GetSubject";
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        searchString: searchValue,
        searchType: searchType === "pib" ? "PIB" : "MB",
      }),
    });

    if (!response.ok) {
      console.log(`APR Unified API failed with status: ${response.status}`);
      
      // Fallback: Try to scrape the public page
      return await scrapeAPRPublicPage(searchValue);
    }

    const data = await response.json();
    console.log("APR API response:", JSON.stringify(data).substring(0, 500));
    
    if (data && data.subjects && data.subjects.length > 0) {
      const subject = data.subjects[0];
      return {
        success: true,
        data: {
          name: subject.name || subject.naziv || "",
          pib: subject.pib || "",
          mb: subject.mb || subject.maticniBroj || "",
          address: subject.address || subject.adresa || "",
          city: subject.city || subject.mesto || "",
          postalCode: subject.postalCode || subject.postanskiBroj || "",
          activityCode: subject.activityCode || subject.sifradelatnosti || "",
          activityName: subject.activityName || subject.nazivDelatnosti || "",
          legalForm: subject.legalForm || subject.pravnaForma || "",
          status: subject.status || "",
        },
      };
    }

    return { success: false, error: "Nije pronađen subjekt sa datim podacima" };
  } catch (error) {
    console.error("APR Unified API error:", error);
    return await scrapeAPRPublicPage(searchValue);
  }
}

async function scrapeAPRPublicPage(searchValue: string): Promise<APRSearchResult> {
  try {
    // Try to use the public APR search page
    const url = `https://pretraga2.apr.gov.rs/unifiedSearch/search?q=${encodeURIComponent(searchValue)}`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "text/html",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return { success: false, error: "APR servis nije dostupan" };
    }

    const html = await response.text();
    
    // Try alternative parsing
    const data = parseAPRHTML(html);
    
    if (data) {
      return { success: true, data };
    }

    return { success: false, error: "Nije pronađen subjekt u APR registru" };
  } catch (error) {
    console.error("Scrape error:", error);
    return { success: false, error: "Greška pri pristupu APR servisu" };
  }
}

function parseAPRResponse(html: string, searchValue: string, searchType: "pib" | "mb"): APRCompanyData | null {
  try {
    // Look for common patterns in APR HTML responses
    // Pattern for company name
    const nameMatch = html.match(/class="company-name[^"]*"[^>]*>([^<]+)</i) ||
                      html.match(/Пословно име[:\s]*<[^>]+>([^<]+)</i) ||
                      html.match(/Naziv[:\s]*<[^>]+>([^<]+)</i);
    
    // Pattern for PIB
    const pibMatch = html.match(/ПИБ[:\s]*(\d{9})/i) ||
                     html.match(/PIB[:\s]*(\d{9})/i) ||
                     html.match(/>(\d{9})</);
    
    // Pattern for MB
    const mbMatch = html.match(/Матични број[:\s]*(\d{8})/i) ||
                    html.match(/MB[:\s]*(\d{8})/i);
    
    // Pattern for address
    const addressMatch = html.match(/Седиште[:\s]*<[^>]+>([^<]+)</i) ||
                         html.match(/Adresa[:\s]*<[^>]+>([^<]+)</i);
    
    // Pattern for activity code
    const activityMatch = html.match(/Претежна делатност[:\s]*(\d{4,5})/i) ||
                          html.match(/Šifra delatnosti[:\s]*(\d{4,5})/i);

    if (nameMatch || pibMatch || mbMatch) {
      return {
        name: nameMatch ? nameMatch[1].trim() : "",
        pib: pibMatch ? pibMatch[1] : (searchType === "pib" ? searchValue : ""),
        mb: mbMatch ? mbMatch[1] : (searchType === "mb" ? searchValue : ""),
        address: addressMatch ? addressMatch[1].trim() : "",
        city: "",
        postalCode: "",
        activityCode: activityMatch ? activityMatch[1] : "",
        activityName: "",
        legalForm: "",
        status: "",
      };
    }

    return null;
  } catch (error) {
    console.error("Parse error:", error);
    return null;
  }
}

function parseAPRHTML(html: string): APRCompanyData | null {
  try {
    // More comprehensive parsing patterns
    const patterns = {
      name: [
        /(?:Пословно име|Naziv|Ime)[\s:]*(?:<[^>]*>)*\s*([^<\n]+)/gi,
        /"naziv"\s*:\s*"([^"]+)"/i,
      ],
      pib: [
        /(?:ПИБ|PIB)[\s:]*(?:<[^>]*>)*\s*(\d{9})/gi,
        /"pib"\s*:\s*"?(\d{9})"?/i,
      ],
      mb: [
        /(?:Матични број|MB|Maticni broj)[\s:]*(?:<[^>]*>)*\s*(\d{8})/gi,
        /"(?:mb|maticniBroj)"\s*:\s*"?(\d{8})"?/i,
      ],
      address: [
        /(?:Адреса|Adresa|Седиште|Sediste)[\s:]*(?:<[^>]*>)*\s*([^<\n]+)/gi,
        /"(?:adresa|address)"\s*:\s*"([^"]+)"/i,
      ],
      city: [
        /(?:Место|Mesto|Grad)[\s:]*(?:<[^>]*>)*\s*([^<\n,]+)/gi,
        /"(?:mesto|city)"\s*:\s*"([^"]+)"/i,
      ],
      activityCode: [
        /(?:Шифра делатности|Sifra delatnosti)[\s:]*(?:<[^>]*>)*\s*(\d{4,5})/gi,
        /"(?:sifradelatnosti|activityCode)"\s*:\s*"?(\d{4,5})"?/i,
      ],
    };

    const extractFirst = (patternList: RegExp[]): string => {
      for (const pattern of patternList) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return "";
    };

    const name = extractFirst(patterns.name);
    const pib = extractFirst(patterns.pib);
    const mb = extractFirst(patterns.mb);

    if (!name && !pib && !mb) {
      return null;
    }

    return {
      name,
      pib,
      mb,
      address: extractFirst(patterns.address),
      city: extractFirst(patterns.city),
      postalCode: "",
      activityCode: extractFirst(patterns.activityCode),
      activityName: "",
      legalForm: "",
      status: "",
    };
  } catch (error) {
    console.error("HTML parse error:", error);
    return null;
  }
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

    const result = await searchAPR(cleanValue, searchType);

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
