import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Microservice endpoints
const IMAGE_MANIPULATOR_URL = 'http://20.106.235.80:8005';
const BIREFNET_URL = 'https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run';
const SAM3_URL = 'https://nemoooooooooo--sam3-service-fastapi-app.modal.run';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'endpoint query parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Proxying ${req.method} to ${endpoint}`);

    let targetUrl: string;
    let targetMethod = req.method;
    let targetBody: string | undefined;
    let targetHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Route to appropriate microservice
    if (endpoint === '/resize') {
      targetUrl = `${IMAGE_MANIPULATOR_URL}/resize`;
      if (req.method === 'POST') {
        targetBody = await req.text();
        console.log('Resize request body:', targetBody);
      }
    } else if (endpoint === '/zoom-check') {
      targetUrl = `${IMAGE_MANIPULATOR_URL}/zoom_check`;
      if (req.method === 'POST') {
        targetBody = await req.text();
        console.log('Zoom check request body:', targetBody);
      }
    } else if (endpoint === '/birefnet/jobs') {
      targetUrl = `${BIREFNET_URL}/jobs`;
      if (req.method === 'POST') {
        targetBody = await req.text();
      }
    } else if (endpoint.startsWith('/birefnet/jobs/')) {
      const jobId = endpoint.replace('/birefnet/jobs/', '');
      targetUrl = `${BIREFNET_URL}/jobs/${jobId}`;
    } else if (endpoint === '/sam3/jobs') {
      targetUrl = `${SAM3_URL}/jobs`;
      if (req.method === 'POST') {
        targetBody = await req.text();
      }
    } else if (endpoint.startsWith('/sam3/jobs/')) {
      const jobId = endpoint.replace('/sam3/jobs/', '');
      targetUrl = `${SAM3_URL}/jobs/${jobId}`;
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Forwarding to: ${targetUrl}`);

    const fetchOptions: RequestInit = {
      method: targetMethod,
      headers: targetHeaders,
    };

    if (targetBody && (targetMethod === 'POST' || targetMethod === 'PUT')) {
      fetchOptions.body = targetBody;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseData = await response.text();

    console.log(`Response from ${endpoint}: status=${response.status}`);
    if (response.status >= 400) {
      console.error(`Error response body:`, responseData);
    }
    try {
      const jsonData = JSON.parse(responseData);
      if (endpoint.includes('/jobs') && !endpoint.includes('/jobs/')) {
        console.log(`Job created:`, jsonData);
      }
    } catch {
      // Not JSON, that's fine
    }

    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('Microservices proxy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
