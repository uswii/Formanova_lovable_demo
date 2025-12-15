import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const A100_BASE_URL = "http://48.214.48.103:8001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    
    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const a100Url = `${A100_BASE_URL}${endpoint}`;
    
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Forward body for POST requests
    if (req.method === "POST") {
      const body = await req.text();
      fetchOptions.body = body;
    }

    console.log(`Proxying ${req.method} to ${a100Url}`);
    
    const response = await fetch(a100Url, fetchOptions);
    const data = await response.text();
    
    // Log response for debugging (truncated for large responses)
    if (endpoint === '/segment' || endpoint === '/generate') {
      try {
        const parsed = JSON.parse(data);
        console.log(`Response from ${endpoint}:`, {
          keys: Object.keys(parsed),
          hasScaledPoints: 'scaled_points' in parsed,
          scaledPointsLength: parsed.scaled_points?.length,
          hasMetrics: 'metrics' in parsed,
          hasFidelityViz: 'fidelity_viz_base64' in parsed,
        });
      } catch (e) {
        console.log(`Response from ${endpoint}: (not JSON)`);
      }
    }
    
    return new Response(data, {
      status: response.status,
      headers: { 
        ...corsHeaders, 
        "Content-Type": response.headers.get("Content-Type") || "application/json" 
      },
    });
  } catch (error) {
    console.error("A100 proxy error:", error);
    return new Response(JSON.stringify({ 
      error: "A100 server unavailable",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
