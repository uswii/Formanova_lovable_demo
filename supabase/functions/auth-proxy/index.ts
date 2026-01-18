import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const AUTH_SERVICE_URL = 'http://20.173.91.22:8009';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/auth-proxy', '');
    const queryString = url.search;
    
    const targetUrl = `${AUTH_SERVICE_URL}${path}${queryString}`;
    console.log(`[auth-proxy] Proxying: ${req.method} ${path}${queryString}`);

    // Forward the request to auth service - preserve original content type
    const contentType = req.headers.get('Content-Type') || 'application/json';
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': contentType,
    };

    // Forward authorization header if present
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    console.log(`[auth-proxy] Content-Type: ${contentType}`);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Forward body for POST/PUT requests
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.text();
      console.log(`[auth-proxy] Body length: ${body.length}`);
      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseText = await response.text();
    
    console.log(`[auth-proxy] Response status: ${response.status}`);

    // Try to parse as JSON, otherwise return as text
    let responseBody: string;
    try {
      JSON.parse(responseText);
      responseBody = responseText;
    } catch {
      responseBody = JSON.stringify({ message: responseText });
    }

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    console.error('[auth-proxy] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
