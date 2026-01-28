import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
};

// A100 server endpoint - use same secret as a100-proxy
const A100_URL = (Deno.env.get('A100_JEWELRY_URL') || 'http://48.214.48.103:8000').replace(/\/+$/, '');

// Auth service for token validation
const AUTH_SERVICE_URL = 'http://20.173.91.22:8002';

// Map plural jewelry types to singular for backend
const JEWELRY_TYPE_MAP: Record<string, string> = {
  'rings': 'ring',
  'bracelets': 'bracelet',
  'earrings': 'earring',
  'necklaces': 'necklace',
  'watches': 'watch',
  // Already singular
  'ring': 'ring',
  'bracelet': 'bracelet',
  'earring': 'earring',
  'necklace': 'necklace',
  'watch': 'watch',
};

// Authentication helper - validates token against custom FastAPI auth service
// Uses X-User-Token header (not Authorization, which Supabase intercepts)
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) {
    console.log('[jewelry-generate] Auth failed: missing X-User-Token header');
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - missing X-User-Token header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  try {
    // Validate token against custom auth service
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });

    if (!response.ok) {
      console.log('[jewelry-generate] Auth failed: token validation returned', response.status);
      return {
        error: new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      };
    }

    const user = await response.json();
    return { userId: user.id || user.email || 'authenticated' };
  } catch (e) {
    console.log('[jewelry-generate] Auth service error:', e);
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - auth service unavailable' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const auth = await authenticateRequest(req);
  if ('error' in auth) {
    return auth.error;
  }
  console.log(`[jewelry-generate] Authenticated user: ${auth.userId}`);

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');

    console.log(`[jewelry-generate] ${req.method} ${endpoint}`);

    // Health check
    if (endpoint === '/health') {
      const response = await fetch(`${A100_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.text();
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate photoshoot
    if (endpoint === '/generate' && req.method === 'POST') {
      const body = await req.json();
      
      // Convert plural jewelry type to singular
      const originalType = body.jewelry_type || 'necklace';
      const singularType = JEWELRY_TYPE_MAP[originalType.toLowerCase()] || 'necklace';
      
      console.log(`[jewelry-generate] Type mapping: ${originalType} -> ${singularType}`);
      console.log(`[jewelry-generate] Skin tone: ${body.skin_tone || 'medium'}`);
      console.log(`[jewelry-generate] Image size: ${body.image_base64?.length || 0} chars`);
      console.log(`[jewelry-generate] Mask size: ${body.mask_base64?.length || 0} chars`);

      // Forward to A100 with singular type
      const a100Body = {
        ...body,
        jewelry_type: singularType,
      };

      // Use AbortController for timeout (5 minutes for necklace generation)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const response = await fetch(`${A100_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a100Body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[jewelry-generate] A100 error: ${response.status} ${errorText}`);
        return new Response(
          JSON.stringify({ error: `Generation failed: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.text();
      console.log(`[jewelry-generate] Success, response size: ${data.length} chars`);

      return new Response(data, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[jewelry-generate] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
