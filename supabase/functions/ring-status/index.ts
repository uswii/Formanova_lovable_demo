import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTH_SERVICE_URL = "https://formanova.ai/auth";

async function authenticateUser(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { await res.text(); return null; }
    const user = await res.json();
    return { userId: user.id || user.email };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const workflowId = url.searchParams.get("workflow_id");
    if (!workflowId) {
      return new Response(JSON.stringify({ error: "workflow_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("Formanova_auth_key");
    const baseUrl = Deno.env.get("FORMANOVA_BASE_URL") || "https://formanova.ai/api";

    const res = await fetch(`${baseUrl}/status/${workflowId}`, {
      headers: {
        "X-API-Key": apiKey!,
        "X-On-Behalf-Of": auth.userId,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ring-status] Backend error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Status check failed (${res.status})` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await res.json();
    const state = (result.runtime?.state || result.progress?.state || "unknown").toLowerCase();

    // Extract progress info from the backend response
    const progress = result.progress || result.runtime || {};
    const completedNodes = progress.completed_nodes ?? 0;
    const totalNodes = progress.total_nodes ?? 0;
    const visited = progress.visited ?? [];
    const progressPct = state === "completed" || state === "done"
      ? 100
      : totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;

    return new Response(JSON.stringify({
      state,
      progress: progressPct,
      completed_nodes: completedNodes,
      total_nodes: totalNodes,
      visited,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ring-status] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
