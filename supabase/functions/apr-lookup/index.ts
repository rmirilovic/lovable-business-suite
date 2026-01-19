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

// Use mblookup.rs API which has valid SSL and provides company data
async function searchMBLookup(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  try {
    console.log(`Searching mblookup.rs for ${searchType}: ${searchValue}`);
    
    // mblookup.rs is a public Serbian company lookup service
    const searchUrl = `https://www.mblookup.rs/api/search/${searchValue}`;
    
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    console.log(`mblookup.rs response status: ${response.status}`);

    if (!response.ok) {
      console.log(`mblookup.rs failed, trying alternative...`);
      return await searchNBSAPI(searchValue, searchType);
    }

    const data = await response.json();
    console.log("mblookup.rs response:", JSON.stringify(data).substring(0, 500));
    
    if (data && (data.naziv || data.name)) {
      return {
        success: true,
        data: {
          name: data.naziv || data.name || "",
          pib: data.pib || "",
          mb: data.mb || data.maticniBroj || "",
          address: data.adresa || data.address || "",
          city: data.mesto || data.city || "",
          postalCode: data.postanskiBroj || data.postalCode || "",
          activityCode: data.sifradelatnosti || data.sifraDelatnosti || data.activityCode || "",
          activityName: data.nazivDelatnosti || data.activityName || "",
          legalForm: data.pravnaForma || data.legalForm || "",
          status: data.status || "",
        },
      };
    }

    // If mblookup.rs doesn't have data, try NBS API
    return await searchNBSAPI(searchValue, searchType);
  } catch (error) {
    console.error("mblookup.rs search error:", error);
    return await searchNBSAPI(searchValue, searchType);
  }
}

// NBS (National Bank of Serbia) has a public API for company lookup
async function searchNBSAPI(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  try {
    console.log(`Searching NBS API for ${searchType}: ${searchValue}`);
    
    // NBS provides company verification API
    const nbsUrl = `https://webservices.nbs.rs/CertificateCheck/CertificateCheckService.asmx/GetSubjectByMB`;
    
    // Try a simpler approach - use podatak.rs which aggregates Serbian company data
    const podaciUrl = `https://podatak.rs/api/firme?q=${searchValue}`;
    
    const response = await fetch(podaciUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    console.log(`podatak.rs response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log("podatak.rs response:", JSON.stringify(data).substring(0, 500));
      
      if (data && Array.isArray(data) && data.length > 0) {
        const company = data[0];
        return {
          success: true,
          data: {
            name: company.naziv || company.name || "",
            pib: company.pib || "",
            mb: company.mb || company.maticniBroj || "",
            address: company.adresa || company.address || "",
            city: company.mesto || company.city || "",
            postalCode: company.postanskiBroj || company.postalCode || "",
            activityCode: company.sifradelatnosti || company.activityCode || "",
            activityName: company.nazivDelatnosti || "",
            legalForm: company.pravnaForma || "",
            status: company.status || "",
          },
        };
      }
    }

    // Last resort - try a CORS-enabled proxy to APR
    return await searchViaProxy(searchValue, searchType);
  } catch (error) {
    console.error("NBS/podatak.rs search error:", error);
    return await searchViaProxy(searchValue, searchType);
  }
}

// Use allorigins.win as a CORS proxy to bypass SSL issues
async function searchViaProxy(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  try {
    console.log(`Searching via proxy for ${searchType}: ${searchValue}`);
    
    // Use allorigins.win as a proxy to fetch APR data
    const aprUrl = `https://pretraga2.apr.gov.rs/unifiedSearchWeb/Search/Search?SearchString=${searchValue}&Office=0`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(aprUrl)}`;
    
    const response = await fetch(proxyUrl, {
      method: "GET",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    console.log(`Proxy response status: ${response.status}`);

    if (!response.ok) {
      return { 
        success: false, 
        error: "APR servis trenutno nije dostupan. Molimo pokušajte kasnije ili unesite podatke ručno." 
      };
    }

    const html = await response.text();
    console.log(`Received HTML via proxy, length: ${html.length}`);
    
    // Parse the HTML for company data
    const companyData = parseAPRHTML(html, searchValue, searchType);
    
    if (companyData) {
      return { success: true, data: companyData };
    }

    return { 
      success: false, 
      error: "Subjekt sa datim PIB/MB nije pronađen u APR registru" 
    };
  } catch (error) {
    console.error("Proxy search error:", error);
    return { 
      success: false, 
      error: "Greška pri pretrazi. Molimo unesite podatke ručno." 
    };
  }
}

function parseAPRHTML(html: string, searchValue: string, searchType: "pib" | "mb"): APRCompanyData | null {
  try {
    // Look for JSON data embedded in the page
    const jsonMatch = html.match(/var\s+model\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      try {
        const model = JSON.parse(jsonMatch[1]);
        if (model && model.subjects && model.subjects.length > 0) {
          const subject = model.subjects[0];
          return {
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
          };
        }
      } catch (e) {
        console.log("JSON parse failed, trying regex patterns");
      }
    }

    // Regex patterns for parsing APR HTML
    const patterns = {
      name: [
        /(?:Пословно име|Naziv|Ime|Firma)[:\s]*(?:<[^>]*>)*\s*([^<\n]+)/gi,
        /"naziv"\s*:\s*"([^"]+)"/i,
        /class="[^"]*naziv[^"]*"[^>]*>([^<]+)</i,
      ],
      pib: [
        /(?:ПИБ|PIB)[:\s]*(?:<[^>]*>)*\s*(\d{9})/gi,
        /"pib"\s*:\s*"?(\d{9})"?/i,
      ],
      mb: [
        /(?:Матични број|MB|Maticni broj)[:\s]*(?:<[^>]*>)*\s*(\d{8})/gi,
        /"(?:mb|maticniBroj)"\s*:\s*"?(\d{8})"?/i,
      ],
      address: [
        /(?:Адреса|Adresa|Седиште|Sediste)[:\s]*(?:<[^>]*>)*\s*([^<\n]+)/gi,
        /"(?:adresa|address)"\s*:\s*"([^"]+)"/i,
      ],
      city: [
        /(?:Место|Mesto|Grad|Naselje)[:\s]*(?:<[^>]*>)*\s*([^<\n,]+)/gi,
        /"(?:mesto|city)"\s*:\s*"([^"]+)"/i,
      ],
      postalCode: [
        /(?:Поштански број|Postanski broj|PTT)[:\s]*(?:<[^>]*>)*\s*(\d{5})/gi,
        /"(?:postanskiBroj|postalCode)"\s*:\s*"?(\d{5})"?/i,
      ],
      activityCode: [
        /(?:Шифра делатности|Sifra delatnosti|Delatnost)[:\s]*(?:<[^>]*>)*\s*(\d{4,5})/gi,
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
    const pib = extractFirst(patterns.pib) || (searchType === "pib" ? searchValue : "");
    const mb = extractFirst(patterns.mb) || (searchType === "mb" ? searchValue : "");

    // Need at least a name to consider it a valid result
    if (!name) {
      return null;
    }

    return {
      name,
      pib,
      mb,
      address: extractFirst(patterns.address),
      city: extractFirst(patterns.city),
      postalCode: extractFirst(patterns.postalCode),
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

    // Try multiple data sources
    const result = await searchMBLookup(cleanValue, searchType);

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
