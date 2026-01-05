/**
 * ============================================================
 * TEMPORAL PROXY - Edge Function
 * ============================================================
 * 
 * PURPOSE:
 * This Edge Function acts as a secure bridge between the React frontend
 * (running in browser) and the Python Temporal backend (running on external server).
 * 
 * WHY WE NEED THIS:
 * 1. The Temporal API server runs on an external VM (20.106.235.80:8000)
 * 2. Browsers can't directly call external servers (CORS, security)
 * 3. This proxy runs on Supabase Edge (Deno) and forwards requests
 * 4. Keeps API URLs and internal architecture hidden from frontend
 * 
 * ARCHITECTURE FLOW:
 * ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
 * │  React Frontend │ ──► │  This Edge Function  │ ──► │  DAG Pipeline API   │
 * │  (Browser)      │     │  (Supabase Edge)     │     │  (20.106.235.80)    │
 * └─────────────────┘     └──────────────────────┘     └─────────────────────┘
 * 
 * ENDPOINTS HANDLED:
 * - /process      → Start a new workflow (FormData with image)
 * - /status/:id   → Get workflow status
 * - /result/:id   → Get completed workflow results
 * - /health       → Check if DAG server is online
 * - /images/fetch → Fetch images from Azure storage
 * - /db/*         → Database operations (users, payments, generations)
 * 
 * USAGE FROM FRONTEND:
 * ```typescript
 * const response = await fetch(
 *   `${SUPABASE_URL}/functions/v1/temporal-proxy?endpoint=/process`,
 *   { method: 'POST', body: formData }
 * );
 * ```
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers - allow any origin for development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// DAG Pipeline API server running on Azure VM
const DAG_API_URL = 'http://20.106.235.80:8000';

/**
 * Main request handler.
 * Routes requests based on the 'endpoint' query parameter.
 */
serve(async (req) => {
  // Handle CORS preflight requests
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
    } else if (endpoint === '/images/fetch') {
      return await handleImageFetch(req);
    } else if (endpoint === '/health') {
      return await handleHealth();
    } else if (endpoint === '/tcp-test') {
      return await handleTcpTest();
    } else {
      // Legacy Temporal endpoints and /db/* routes
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

/**
 * Handle /process endpoint - Start a new workflow.
 * 
 * Accepts either:
 * 1. multipart/form-data with 'file', 'workflow_name', 'overrides'
 * 2. JSON with 'image_base64', 'workflow_name', 'overrides'
 * 
 * The DAG server will:
 * 1. Upload the image to Azure
 * 2. Start the specified workflow
 * 3. Return a workflow_id for status polling
 */
async function handleProcess(req: Request): Promise<Response> {
  console.log('[DAG] Processing workflow request');
  
  const contentType = req.headers.get('content-type') || '';
  
  if (contentType.includes('multipart/form-data')) {
    // Forward FormData request directly - this is the correct approach
    const formData = await req.formData();
    
    // Log for debugging
    console.log('[DAG] workflow_name:', formData.get('workflow_name'));
    console.log('[DAG] has file:', !!formData.get('file'));
    const overridesStr = String(formData.get('overrides') || '');
    console.log('[DAG] overrides:', overridesStr.slice(0, 300));
    
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
    
    // Build overrides - include original_path for flux_gen_pipeline
    const overrides = body.overrides || {};
    
    // Handle base64 image - backend requires 'file' field
    // Also add to overrides as original_path for the pipeline mapping
    if (body.image_base64) {
      const base64Data = body.image_base64;
      
      // Add image to overrides as original_path (pipeline expects root.original_path)
      overrides.original_path = base64Data;
      
      // Also create file blob for the 'file' field
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      formData.append('file', blob, 'image.jpg');
    }
    
    formData.append('overrides', JSON.stringify(overrides));
    
    console.log('[DAG] Converted JSON to FormData, workflow:', body.workflow_name);
    console.log('[DAG] Overrides keys:', Object.keys(overrides));
    console.log('[DAG] Has file:', !!body.image_base64);
    console.log('[DAG] Has original_path in overrides:', !!overrides.original_path);
    
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

/**
 * Handle /status/:workflow_id endpoint.
 * Returns the current status of a running workflow.
 * 
 * Status values: 'running', 'completed', 'failed', 'cancelled'
 */
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

/**
 * Handle /result/:workflow_id endpoint.
 * Returns the final output of a completed workflow.
 * 
 * Includes: generated image URIs, fidelity metrics, etc.
 */
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

/**
 * Handle /health endpoint.
 * Checks if the DAG pipeline server is reachable.
 * Used by the frontend to show server status indicator.
 */
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
    // DAG server not reachable - return offline status
    return new Response(
      JSON.stringify({ 
        status: 'offline',
        error: 'DAG pipeline server not reachable' 
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle /images/fetch endpoint.
 * Fetches images from Azure storage and returns them as base64.
 */
async function handleImageFetch(req: Request): Promise<Response> {
  console.log('[DAG] Fetching images');
  
  const body = await req.json();
  
  const response = await fetch(`${DAG_API_URL}/images/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  const data = await response.text();
  console.log('[DAG] Image fetch response:', response.status, data.substring(0, 200));
  
  return new Response(data, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}

/**
 * Handle /tcp-test endpoint.
 * Low-level TCP connectivity test to the DAG server.
 * Useful for debugging network issues.
 */
async function handleTcpTest(): Promise<Response> {
  console.log('[DAG] TCP connection test');
  
  const host = '20.106.235.80';
  const port = 8000;
  
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    
    return new Response(
      JSON.stringify({ 
        status: 'success',
        message: `TCP connection to ${host}:${port} successful`,
        host,
        port
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        status: 'failed',
        message: `TCP connection to ${host}:${port} failed`,
        error: errorMessage,
        host,
        port
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ========== Legacy Temporal & Database Handlers ==========

/**
 * Handle legacy endpoints and /db/* routes.
 * 
 * Routes to TEMPORAL_API_URL (Python backend) for:
 * - /db/users/* - User CRUD operations
 * - /db/payments/* - Payment operations  
 * - /db/generations/* - Generation tracking
 * - /workflow/* - Direct Temporal workflow operations
 * 
 * The TEMPORAL_API_URL is set in Supabase secrets.
 */
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
