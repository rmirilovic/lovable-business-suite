import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExchangeRate {
  currencyCode: string;
  currencyName: string;
  unit: number;
  buyingRate: number | null;
  middleRate: number | null;
  sellingRate: number | null;
}

function buildSoapRequest(username: string, password: string, date?: string): { body: string; action: string } {
  const ns = "http://communicationoffice.nbs.rs/";

  if (date) {
    return {
      action: `${ns}GetExchangeRateByDate`,
      body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthenticationHeader xmlns="${ns}">
      <UserName>${username}</UserName>
      <Password>${password}</Password>
      <LicenceID></LicenceID>
    </AuthenticationHeader>
  </soap:Header>
  <soap:Body>
    <GetExchangeRateByDate xmlns="${ns}">
      <date>${date}</date>
      <exchangeRateListTypeID>2</exchangeRateListTypeID>
    </GetExchangeRateByDate>
  </soap:Body>
</soap:Envelope>`,
    };
  }

  return {
    action: `${ns}GetCurrentExchangeRate`,
    body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthenticationHeader xmlns="${ns}">
      <UserName>${username}</UserName>
      <Password>${password}</Password>
      <LicenceID></LicenceID>
    </AuthenticationHeader>
  </soap:Header>
  <soap:Body>
    <GetCurrentExchangeRate xmlns="${ns}">
      <exchangeRateListTypeID>2</exchangeRateListTypeID>
    </GetCurrentExchangeRate>
  </soap:Body>
</soap:Envelope>`,
  };
}

function parseExchangeRates(xml: string): { rates: ExchangeRate[]; listDate: string; listNumber: string } {
  const rates: ExchangeRate[] = [];
  let listDate = "";
  let listNumber = "";

  // Extract list date
  const dateMatch = xml.match(/Datum[^>]*>([^<]+)</i) || xml.match(/CreateDate[^>]*>([^<]+)</i);
  if (dateMatch) listDate = dateMatch[1].trim();

  const listNumMatch = xml.match(/BrojKursneListe[^>]*>([^<]+)</i) || xml.match(/ExchangeRateListNumber[^>]*>([^<]+)</i);
  if (listNumMatch) listNumber = listNumMatch[1].trim();

  // Parse individual currency rows from the XML
  // NBS XML typically has rows with: SifraValute, NazivValute, Jedinica, KupovniKurs, SrednjiKurs, ProdajniKurs
  const rowRegex = /<ExchangeRate[^s][^>]*>([\s\S]*?)<\/ExchangeRate>/gi;
  let match;

  while ((match = rowRegex.exec(xml)) !== null) {
    const row = match[1];
    const extract = (tag: string): string => {
      const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i").exec(row);
      return m ? m[1].trim() : "";
    };

    const code = extract("CurrencyCodeNumChar") || extract("SifraValute") || extract("CurrencyCode");
    const name = extract("CurrencyNameSerCyrl") || extract("NazivValute") || extract("CurrencyName") || extract("CurrencyCodeAlfaChar");
    const unit = parseInt(extract("Unit") || extract("Jedinica") || "1", 10);
    const buying = parseFloat((extract("BuyingRate") || extract("KupovniKurs") || "").replace(",", "."));
    const middle = parseFloat((extract("MiddleRate") || extract("SrednjiKurs") || "").replace(",", "."));
    const selling = parseFloat((extract("SellingRate") || extract("ProdajniKurs") || "").replace(",", "."));

    if (code || name) {
      rates.push({
        currencyCode: code,
        currencyName: name,
        unit: unit || 1,
        buyingRate: isNaN(buying) ? null : buying,
        middleRate: isNaN(middle) ? null : middle,
        sellingRate: isNaN(selling) ? null : selling,
      });
    }
  }

  // Fallback: try parsing diffgram table rows
  if (rates.length === 0) {
    const tableRowRegex = /<Table[^>]*>([\s\S]*?)<\/Table>/gi;
    while ((match = tableRowRegex.exec(xml)) !== null) {
      const row = match[1];
      const extract = (tag: string): string => {
        const m = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i").exec(row);
        return m ? m[1].trim() : "";
      };

      const code = extract("x0428_x0438_x0444_x0440_x0430_x0412_x0430_x043B_x0443_x0442_x0435") || 
                   extract("CurrencyCodeNumChar") || extract("SifraValute");
      const name = extract("x041D_x0430_x0437_x0438_x0432_x0417_x0435_x043C_x0459_x0435") ||
                   extract("CurrencyNameSerCyrl") || extract("NazivZemlje");
      const unit = parseInt(extract("x0408_x0435_x0434_x0438_x043D_x0438_x0446_x0430") || extract("Jedinica") || extract("Unit") || "1", 10);
      const buying = parseFloat((extract("x041A_x0443_x043F_x043E_x0432_x043D_x0438") || extract("KupovniKurs") || extract("BuyingRate") || "").replace(",", "."));
      const middle = parseFloat((extract("x0421_x0440_x0435_x0434_x045A_x0438") || extract("SrednjiKurs") || extract("MiddleRate") || "").replace(",", "."));
      const selling = parseFloat((extract("x041F_x0440_x043E_x0434_x0430_x0458_x043D_x0438") || extract("ProdajniKurs") || extract("SellingRate") || "").replace(",", "."));

      if (middle || buying || selling) {
        rates.push({
          currencyCode: code,
          currencyName: name,
          unit: unit || 1,
          buyingRate: isNaN(buying) ? null : buying,
          middleRate: isNaN(middle) ? null : middle,
          sellingRate: isNaN(selling) ? null : selling,
        });
      }
    }
  }

  return { rates, listDate, listNumber };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const username = Deno.env.get("NBS_USERNAME");
    const password = Deno.env.get("NBS_PASSWORD");

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "NBS kredencijali nisu konfigurisani" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { date } = await req.json().catch(() => ({}));

    const endpoint = "https://webservices.nbs.rs/CommunicationOfficeService1_0/ExchangeRateXmlService.asmx";
    const { body: soapBody, action } = buildSoapRequest(username, password, date);

    console.log(`Calling NBS exchange rate API, action: ${action}, date: ${date || "current"}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": action,
      },
      body: soapBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("NBS error:", errText.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "NBS servis je vratio grešku" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const xmlText = await response.text();
    console.log("NBS response length:", xmlText.length);
    console.log("NBS response preview:", xmlText.substring(0, 1000));

    const { rates, listDate, listNumber } = parseExchangeRates(xmlText);

    console.log(`Parsed ${rates.length} exchange rates`);

    return new Response(
      JSON.stringify({ success: true, rates, listDate, listNumber, rawLength: xmlText.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Serverska greška" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
