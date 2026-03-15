import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CURRENCIES = ["eur", "usd", "chf", "gbp", "aud", "cad", "czk", "dkk", "huf", "jpy", "nok", "sek", "pln", "rub", "try", "cny"];

interface RateResponse {
  code: string;
  date: string;
  number: number;
  parity: number;
  exchange_buy: number;
  exchange_middle: number;
  exchange_sell: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date } = await req.json().catch(() => ({}));
    const baseUrl = "https://kurs.resenje.org/api/v1/currencies";

    const results: RateResponse[] = [];

    // Fetch EUR and USD (and optionally more) in parallel
    const fetches = CURRENCIES.map(async (code) => {
      try {
        const url = date
          ? `${baseUrl}/${code}/rates/${date}`
          : `${baseUrl}/${code}/rates/today`;
        
        console.log(`Fetching: ${url}`);
        const resp = await fetch(url);
        
        if (!resp.ok) {
          console.log(`${code} returned ${resp.status}`);
          return null;
        }
        
        const data = await resp.json();
        return data as RateResponse;
      } catch (err) {
        console.error(`Error fetching ${code}:`, err);
        return null;
      }
    });

    const fetchResults = await Promise.all(fetches);
    
    for (const r of fetchResults) {
      if (r && r.exchange_middle) {
        results.push(r);
      }
    }

    console.log(`Fetched ${results.length} exchange rates`);

    const rates = results.map((r) => ({
      currencyCode: r.code,
      currencyName: r.code,
      unit: r.parity || 1,
      buyingRate: r.exchange_buy,
      middleRate: r.exchange_middle,
      sellingRate: r.exchange_sell,
      date: r.date,
    }));

    // Sort EUR/USD first
    const priority = ["EUR", "USD", "CHF", "GBP"];
    rates.sort((a, b) => {
      const ai = priority.indexOf(a.currencyCode);
      const bi = priority.indexOf(b.currencyCode);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const listDate = rates.length > 0 ? rates[0].date : "";

    return new Response(
      JSON.stringify({ success: true, rates, listDate }),
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
