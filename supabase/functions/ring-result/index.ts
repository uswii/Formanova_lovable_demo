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

function azureUriToUrl(uri: string): string {
  if (uri.startsWith("azure://")) {
    return `https://snapwear.blob.core.windows.net/${uri.replace("azure://", "")}`;
  }
  return uri;
}

function extractGlbUrl(result: Record<string, unknown>): string | null {
  const successFinal = result["success_final"] as unknown[];
  if (Array.isArray(successFinal) && successFinal.length > 0) {
    const entry = successFinal[0] as Record<string, unknown>;
    const artifact = entry?.glb_artifact as Record<string, unknown>;
    if (artifact?.uri && typeof artifact.uri === "string") {
      return azureUriToUrl(artifact.uri);
    }
  }

  const successOriginal = result["success_original_glb"] as unknown[];
  if (Array.isArray(successOriginal) && successOriginal.length > 0) {
    const entry = successOriginal[0] as Record<string, unknown>;
    const artifact = entry?.glb_artifact as Record<string, unknown>;
    if (artifact?.uri && typeof artifact.uri === "string") {
      return azureUriToUrl(artifact.uri);
    }
  }

  return null;
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

    const res = await fetch(`${baseUrl}/result/${workflowId}`, {
      headers: {
        "X-API-Key": apiKey!,
        "X-On-Behalf-Of": auth.userId,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ring-result] Backend error:", res.status, errText);
      return new Response(JSON.stringify({ error: `Result fetch failed (${res.status})` }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await res.json();
    const glbUrl = extractGlbUrl(result);

    if (!glbUrl) {
      const failedFinal = result["failed_final"] as unknown[];
      if (Array.isArray(failedFinal) && failedFinal.length > 0) {
        return new Response(JSON.stringify({ error: "Generation failed — no valid model produced" }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "No GLB model found in results" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ring-result] GLB URL resolved for ${workflowId}`);
    return new Response(JSON.stringify({ glb_url: glbUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ring-result] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
