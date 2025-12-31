import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// DAG Pipeline API at 20.106.235.80:8001
const DAG_API_URL = 'http://20.106.235.80:8001';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || '/health';

    // Route to appropriate handler based on endpoint
    if (endpoint === '/process') {
      return await handleProcess(req);
    } else if (endpoint.startsWith('/status/')) {
      return await handleStatus(endpoint);
    } else if (endpoint.startsWith('/result/')) {
      return await handleResult(endpoint);
    } else if (endpoint === '/health') {
      return await handleHealth();
    } else {
      // Legacy Temporal endpoints - fall back to old behavior
      return await handleLegacy(req, endpoint);
    }
  } catch (error) {
    console.error('Temporal proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to connect to API',
        details: errorMessage 
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== DAG Pipeline Handlers ==========

async function handleProcess(req: Request): Promise<Response> {
  console.log('[DAG] Processing workflow request');
  
  const contentType = req.headers.get('content-type') || '';
  
  if (contentType.includes('multipart/form-data')) {
    // Forward FormData request directly
    const formData = await req.formData();
    
    console.log('[DAG] FormData keys:', [...formData.keys()]);
    
    const response = await fetch(`${DAG_API_URL}/process`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.text();
    console.log('[DAG] Process response:', response.status, data.substring(0, 200));
    
    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } else {
    // JSON request - convert to FormData
    const body = await req.json();
    
    const formData = new FormData();
    formData.append('workflow_name', body.workflow_name);
    
    if (body.overrides) {
      formData.append('overrides', JSON.stringify(body.overrides));
    }
    
    // Handle base64 image
    if (body.image_base64) {
      const imageBytes = Uint8Array.from(atob(body.image_base64), c => c.charCodeAt(0));
      const blob = new Blob([imageBytes], { type: 'image/jpeg' });
      formData.append('file', blob, 'image.jpg');
    }
    
    console.log('[DAG] Converted JSON to FormData, workflow:', body.workflow_name);
    
    const response = await fetch(`${DAG_API_URL}/process`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.text();
    console.log('[DAG] Process response:', response.status, data.substring(0, 200));
    
    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  }
}

async function handleStatus(endpoint: string): Promise<Response> {
  const workflowId = endpoint.replace('/status/', '');
  console.log('[DAG] Getting status for workflow:', workflowId);
  
  const response = await fetch(`${DAG_API_URL}/status/${workflowId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const data = await response.text();
  console.log('[DAG] Status response:', response.status, data.substring(0, 200));
  
  return new Response(data, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

async function handleResult(endpoint: string): Promise<Response> {
  const workflowId = endpoint.replace('/result/', '');
  console.log('[DAG] Getting result for workflow:', workflowId);
  
  const response = await fetch(`${DAG_API_URL}/result/${workflowId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const data = await response.text();
  console.log('[DAG] Result response:', response.status, data.substring(0, 200));
  
  return new Response(data, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

async function handleHealth(): Promise<Response> {
  console.log('[DAG] Health check');
  
  try {
    const response = await fetch(`${DAG_API_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // DAG server not reachable
    return new Response(
      JSON.stringify({ 
        status: 'offline',
        error: 'DAG pipeline server not reachable' 
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ========== Legacy Temporal Handlers ==========

async function handleLegacy(req: Request, endpoint: string): Promise<Response> {
  const TEMPORAL_API_URL = Deno.env.get('TEMPORAL_API_URL');
  
  if (!TEMPORAL_API_URL) {
    return new Response(
      JSON.stringify({ error: 'TEMPORAL_API_URL not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const targetUrl = `${TEMPORAL_API_URL}${endpoint}`;
  console.log(`[Legacy] Proxying ${req.method} request to: ${targetUrl}`);

  const fetchOptions: RequestInit = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Forward body for POST requests
  if (req.method === 'POST') {
    const body = await req.text();
    if (body) {
      fetchOptions.body = body;
    }
  }

  const response = await fetch(targetUrl, fetchOptions);
  const data = await response.text();

  return new Response(data, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}
