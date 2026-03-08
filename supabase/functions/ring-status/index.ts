import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = data.claims.sub as string;

    const url = new URL(req.url);
    const workflowId = url.searchParams.get("workflow_id");
    if (!workflowId) {
      return new Response(JSON.stringify({ error: "workflow_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("FORMANOVA_API_KEY");
    const baseUrl = Deno.env.get("FORMANOVA_BASE_URL") || "https://formanova.ai/api";

    const res = await fetch(`${baseUrl}/status/${workflowId}`, {
      headers: {
        "X-API-Key": apiKey!,
        "X-On-Behalf-Of": userId,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ring-status] Backend error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Status check failed (${res.status})` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await res.json();
    const state = (result.runtime?.state || "unknown").toLowerCase();

    return new Response(JSON.stringify({ state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ring-status] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
