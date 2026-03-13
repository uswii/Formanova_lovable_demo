import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function getAdminEmails(): string[] {
  const raw = Deno.env.get("ADMIN_EMAILS") || "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

async function resolveCallerEmail(req: Request): Promise<string | null> {
  // Try external auth service first (same pattern as other admin functions)
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const authServiceUrl = Deno.env.get("AUTH_SERVICE_URL");
  if (authServiceUrl) {
    try {
      const res = await fetch(`${authServiceUrl}/users/me`, {
        headers: { Authorization: authHeader },
      });
      if (res.ok) {
        const user = await res.json();
        return user.email?.toLowerCase() || null;
      }
    } catch {
      // fall through to Supabase auth
    }
  }

  // Fallback: Supabase JWT
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace("Bearer ", "");
  const { data } = await sb.auth.getUser(token);
  return data?.user?.email?.toLowerCase() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const email = await resolveCallerEmail(req);
    const admins = getAdminEmails();
    if (!email || !admins.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/admin-promo-codes");
    const subPath = pathParts.length > 1 ? pathParts[1] : "/";

    // GET / — list all promo codes
    if (req.method === "GET" && (subPath === "/" || subPath === "")) {
      const { data, error } = await sb
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST / — create promo code
    if (req.method === "POST" && (subPath === "/" || subPath === "")) {
      const body = await req.json();
      const { code, campaign, credits, max_uses, expires_at } = body;

      if (!code || credits === undefined) {
        return new Response(JSON.stringify({ error: "code and credits are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await sb
        .from("promo_codes")
        .insert({
          code: code.toUpperCase().trim(),
          campaign: campaign || "",
          credits: Number(credits),
          max_uses: max_uses ? Number(max_uses) : null,
          expires_at: expires_at || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "Code already exists" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /:id — update promo code
    const idMatch = subPath.match(/^\/([0-9a-f-]{36})$/);
    if (req.method === "PUT" && idMatch) {
      const id = idMatch[1];
      const body = await req.json();
      const allowed = ["code", "campaign", "credits", "max_uses", "expires_at", "is_active"];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (body[key] !== undefined) {
          updates[key] = body[key];
        }
      }
      if (updates.code) updates.code = (updates.code as string).toUpperCase().trim();

      const { data, error } = await sb
        .from("promo_codes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /:id — deactivate (soft)
    if (req.method === "DELETE" && idMatch) {
      const id = idMatch[1];
      const { data, error } = await sb
        .from("promo_codes")
        .update({ is_active: false })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin-promo-codes] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
