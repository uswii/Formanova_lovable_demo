import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Use secret or fallback - remove trailing slash to avoid double slashes
const A100_BASE_URL = (Deno.env.get("A100_JEWELRY_URL") || "http://20.106.235.80:8000").replace(/\/+$/, '');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Authentication helper - validates JWT and returns user ID
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - missing or invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) {
    console.log('[a100-proxy] Auth failed:', error?.message);
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  return { userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const auth = await authenticateRequest(req);
  if ('error' in auth) {
    return auth.error;
  }
  console.log(`[a100-proxy] Authenticated user: ${auth.userId}`);

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
      
      // Log jewelry_type for segment requests
      if (endpoint === '/segment') {
        try {
          const parsed = JSON.parse(body);
          console.log(`[segment] jewelry_type: ${parsed.jewelry_type || 'necklace (default)'}, points: ${parsed.points?.length || 0}`);
        } catch (e) {}
      }
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
