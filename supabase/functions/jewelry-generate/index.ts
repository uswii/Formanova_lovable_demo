import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// A100 server endpoint - use same secret as a100-proxy
const A100_URL = (Deno.env.get('A100_JEWELRY_URL') || 'http://48.214.48.103:8000').replace(/\/+$/, '');

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

      const response = await fetch(`${A100_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a100Body),
      });

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
