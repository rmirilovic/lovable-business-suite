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

// NBS SOAP API - search by PIB or MB
async function searchNBS(searchValue: string, searchType: "pib" | "mb"): Promise<APRSearchResult> {
  const username = Deno.env.get("NBS_USERNAME");
  const password = Deno.env.get("NBS_PASSWORD");

  if (!username || !password) {
    console.error("NBS credentials not configured");
    return {
      success: false,
      error: "NBS kredencijali nisu konfigurisani",
    };
  }

  try {
    console.log(`Searching NBS for ${searchType}: ${searchValue}`);

    // NBS SOAP endpoint
    const soapEndpoint = "https://webservices.nbs.rs/CommunicationOfficeService1_0/CompanyAccountXmlService.asmx";

    // SOAP request body - using GetCompanyAccountByNationalIdentificationNumber for PIB
    // or we can try GetCompanyAccountByRegistrationNumber for MB
    const soapAction = searchType === "pib" 
      ? "http://communicationoffice.nbs.rs/GetCompanyAccountByNationalIdentificationNumber"
      : "http://communicationoffice.nbs.rs/GetCompanyAccountByRegistrationNumber";

    const soapBody = searchType === "pib" 
      ? `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCompanyAccountByNationalIdentificationNumber xmlns="http://communicationoffice.nbs.rs/">
      <userName>${username}</userName>
      <password>${password}</password>
      <nationalIdentificationNumber>${searchValue}</nationalIdentificationNumber>
    </GetCompanyAccountByNationalIdentificationNumber>
  </soap:Body>
</soap:Envelope>`
      : `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCompanyAccountByRegistrationNumber xmlns="http://communicationoffice.nbs.rs/">
      <userName>${username}</userName>
      <password>${password}</password>
      <registrationNumber>${searchValue}</registrationNumber>
    </GetCompanyAccountByRegistrationNumber>
  </soap:Body>
</soap:Envelope>`;

    console.log(`Calling NBS SOAP endpoint with action: ${soapAction}`);

    const response = await fetch(soapEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: soapBody,
    });

    console.log(`NBS response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NBS error response: ${errorText}`);
      return {
        success: false,
        error: "NBS servis je vratio grešku. Pokušajte ponovo.",
      };
    }

    const responseText = await response.text();
    console.log(`NBS response length: ${responseText.length}`);
    console.log(`NBS response preview: ${responseText.substring(0, 500)}`);

    // Parse the SOAP response
    const companyData = parseNBSResponse(responseText, searchValue, searchType);

    if (companyData) {
      console.log("Successfully parsed NBS data:", companyData);
      return { success: true, data: companyData };
    }

    return {
      success: false,
      error: "Subjekt sa datim PIB/MB nije pronađen u NBS registru",
    };
  } catch (error) {
    console.error("NBS search error:", error);
    return {
      success: false,
      error: "Greška pri pristupu NBS servisu. Pokušajte ponovo.",
    };
  }
}

function parseNBSResponse(xml: string, searchValue: string, searchType: "pib" | "mb"): APRCompanyData | null {
  try {
    // Extract data from XML response
    // NBS response contains company info in various tags
    
    const extractTag = (tagName: string): string => {
      // Try various patterns for SOAP response
      const patterns = [
        new RegExp(`<${tagName}>([^<]+)</${tagName}>`, "i"),
        new RegExp(`<[a-z]*:${tagName}>([^<]+)</[a-z]*:${tagName}>`, "i"),
        new RegExp(`"${tagName}"\\s*:\\s*"([^"]+)"`, "i"),
      ];
      
      for (const pattern of patterns) {
        const match = pattern.exec(xml);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
      return "";
    };

    // Common tag names in NBS response
    const name = extractTag("Name") || 
                 extractTag("CompanyName") || 
                 extractTag("Naziv") ||
                 extractTag("PoslovnoIme");
    
    const pib = searchType === "pib" 
      ? searchValue 
      : (extractTag("NationalIdentificationNumber") || 
         extractTag("PIB") || 
         extractTag("Pib"));
    
    const mb = searchType === "mb" 
      ? searchValue 
      : (extractTag("RegistrationNumber") || 
         extractTag("MB") || 
         extractTag("MaticniBroj"));
    
    const address = extractTag("Address") || 
                    extractTag("Street") || 
                    extractTag("Adresa") ||
                    extractTag("Ulica");
    
    const city = extractTag("City") || 
                 extractTag("Place") || 
                 extractTag("Mesto") ||
                 extractTag("Grad");
    
    const postalCode = extractTag("PostalCode") || 
                       extractTag("ZipCode") || 
                       extractTag("PostanskiBroj");
    
    const activityCode = extractTag("ActivityCode") || 
                         extractTag("SifraDelatnosti");

    // Check for error/fault in response
    const hasFault = xml.includes("Fault") || xml.includes("fault");
    const hasError = xml.includes("<Error>") || xml.includes("<error>");
    
    if (hasFault || hasError) {
      console.log("NBS response contains error/fault");
      return null;
    }

    // If we have at least a name, return the data
    if (name) {
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

    console.log("Could not extract company name from NBS response");
    return null;
  } catch (error) {
    console.error("Error parsing NBS response:", error);
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

    console.log(`APR/NBS lookup request - type: ${searchType}, value: ${searchValue}`);

    if (!searchValue || !searchType) {
      return new Response(
        JSON.stringify({ success: false, error: "Nedostaju parametri pretrage" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input
    const cleanValue = searchValue.replace(/\D/g, "");

    if (searchType === "pib" && cleanValue.length !== 9) {
      return new Response(
        JSON.stringify({ success: false, error: "PIB mora imati 9 cifara" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (searchType === "mb" && cleanValue.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Matični broj mora imati 8 cifara" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use NBS API to search
    const result = await searchNBS(cleanValue, searchType);

    console.log(`Lookup result:`, JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Serverska greška",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
