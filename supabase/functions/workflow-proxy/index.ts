import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Backend URLs
// Temporal gateway (20.173.91.22:8000) - for orchestrated workflows and standalone tools
const TEMPORAL_URL = (Deno.env.get('TEMPORAL_API_URL') || 'http://20.173.91.22:8000').replace(/\/+$/, '');
// Standalone server - now using Temporal backend (20.173.91.22:8000)
const STANDALONE_URL = (Deno.env.get('A100_STANDALONE_URL') || 'http://20.173.91.22:8000').replace(/\/+$/, '');
// Direct API on Temporal server (20.173.91.22:8001) - for multipart/masking tools
const DIRECT_API_URL = (Deno.env.get('A100_JEWELRY_URL') || 'http://20.173.91.22:8001').replace(/\/+$/, '');
// Auth service for token validation
const AUTH_SERVICE_URL = 'http://20.173.91.22:8002';

// Helper to get backend URL based on mode parameter
// Usage: ?mode=standalone (default) or ?mode=temporal
function getBackendUrl(mode: string | null): string {
  if (mode === 'temporal') {
    console.log(`[workflow-proxy] Using TEMPORAL mode -> ${TEMPORAL_URL}`);
    return TEMPORAL_URL;
  }
  // Default to standalone (A100 at 48.214.48.103:8000)
  console.log(`[workflow-proxy] Using STANDALONE mode -> ${STANDALONE_URL}`);
  return STANDALONE_URL;
}

// Authentication helper - validates token against custom FastAPI auth service
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - missing or invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  try {
    // Validate token against custom auth service
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 'Authorization': authHeader },
    });

    if (!response.ok) {
      console.log('[workflow-proxy] Auth failed: token validation returned', response.status);
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
    console.log('[workflow-proxy] Auth service error:', e);
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
  console.log(`[workflow-proxy] Authenticated user: ${auth.userId}`);

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || '/process';
    const mode = url.searchParams.get('mode'); // 'temporal' (default) or 'standalone'
    
    // Get backend URL based on mode
    const BACKEND_URL = getBackendUrl(mode);

    console.log(`[workflow-proxy] ${req.method} ${endpoint} (mode: ${mode || 'temporal'})`);

    // Health check
    if (endpoint === '/health') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const data = await response.text();
        return new Response(data, {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({ status: 'offline', error: e instanceof Error ? e.message : 'Unknown' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Status check for workflow
    if (endpoint.startsWith('/status/')) {
      const workflowId = endpoint.replace('/status/', '');
      const response = await fetch(`${BACKEND_URL}/status/${workflowId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.text();
      
      // Log FULL status response to debug what results are available
      try {
        const parsed = JSON.parse(data);
        if (parsed.progress?.state === 'completed') {
          console.log(`[workflow-proxy] Status COMPLETED for ${workflowId}`);
          console.log(`[workflow-proxy] Status results keys:`, parsed.results ? Object.keys(parsed.results) : 'no results');
          
          // Log each result key with more detail to find Azure URIs
          if (parsed.results) {
            for (const key of Object.keys(parsed.results)) {
              const arr = parsed.results[key];
              if (Array.isArray(arr) && arr.length > 0) {
                const first = arr[0];
                const keys = first && typeof first === 'object' ? Object.keys(first) : [];
                console.log(`[workflow-proxy] Status result "${key}": keys=${JSON.stringify(keys)}`);
                
                // Check for Azure URIs in common fields
                if (first && typeof first === 'object') {
                  for (const fieldKey of ['image_base64', 'mask', 'mask_base64']) {
                    const field = first[fieldKey];
                    if (field && typeof field === 'object' && field.uri) {
                      console.log(`[workflow-proxy] Found Azure URI in ${key}.${fieldKey}: ${field.uri}`);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) { /* ignore parse errors */ }
      
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Result fetch for workflow
    if (endpoint.startsWith('/result/')) {
      const workflowId = endpoint.replace('/result/', '');
      const response = await fetch(`${BACKEND_URL}/result/${workflowId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.text();
      
      // Log result response to debug what's being returned
      try {
        const parsed = JSON.parse(data);
        console.log(`[workflow-proxy] Result for ${workflowId}, keys:`, Object.keys(parsed));
        // Log first few chars of each key to see structure
        for (const key of Object.keys(parsed)) {
          const val = parsed[key];
          console.log(`[workflow-proxy] Result key "${key}":`, Array.isArray(val) ? `array[${val.length}]` : typeof val);
        }
      } catch (e) { /* ignore parse errors */ }
      
      return new Response(data, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process workflow - forward FormData as-is
    if (endpoint === '/process' && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      
      // Get the raw body as ArrayBuffer for FormData
      const body = await req.arrayBuffer();
      
      console.log(`[workflow-proxy] Forwarding to ${BACKEND_URL}/process`);
      console.log(`[workflow-proxy] Content-Type: ${contentType}`);
      console.log(`[workflow-proxy] Body size: ${body.byteLength} bytes`);

      // Use AbortController for 10 minute timeout (DAG workflows can be long)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min

      try {
        const response = await fetch(`${BACKEND_URL}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': contentType, // Forward the multipart boundary
          },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[workflow-proxy] Backend error: ${response.status} ${errorText}`);
          return new Response(
            JSON.stringify({ error: `Workflow failed: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        console.log(`[workflow-proxy] Success, response size: ${data.length} chars`);

        // Try to parse and log workflow info
        try {
          const parsed = JSON.parse(data);
          console.log(`[workflow-proxy] Workflow response:`, {
            workflow_id: parsed.workflow_id,
            status: parsed.status,
            keys: Object.keys(parsed),
          });
        } catch (e) {
          // Not JSON, that's okay
        }

        return new Response(data, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Workflow timed out after 10 minutes' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    // Agentic masking endpoint - forward JSON to /tools/agentic_masking/run
    if (endpoint === '/tools/agentic_masking/run' && req.method === 'POST') {
      const body = await req.json();
      
      // Transform the request - API expects image as {base64: rawData} format
      let imageObj = body.data?.image;
      if (typeof imageObj === 'string') {
        // Strip data URI prefix if present: "data:image/jpeg;base64,..." -> raw base64
        const base64Data = imageObj.includes(',') 
          ? imageObj.split(',')[1] 
          : imageObj;
        imageObj = { base64: base64Data };
      }
      
      const transformedBody = {
        data: {
          ...body.data,
          image: imageObj,
        }
      };
      
      console.log(`[workflow-proxy] Forwarding to ${STANDALONE_URL}/tools/agentic_masking/run`);
      console.log(`[workflow-proxy] Image transformed to {base64: ...} format`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min

      try {
        const response = await fetch(`${STANDALONE_URL}/tools/agentic_masking/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transformedBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[workflow-proxy] Agentic masking error: ${response.status} ${errorText}`);
          return new Response(
            JSON.stringify({ error: `Agentic masking failed: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        console.log(`[workflow-proxy] Agentic masking success, response size: ${data.length} chars`);

        try {
          const parsed = JSON.parse(data);
          console.log(`[workflow-proxy] Agentic masking response keys:`, Object.keys(parsed));
          // Log resize_metadata specifically to debug the format
          if (parsed.resize_metadata) {
            console.log(`[workflow-proxy] resize_metadata:`, JSON.stringify(parsed.resize_metadata));
          }
        } catch (e) {
          // Not JSON
        }

        return new Response(data, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Agentic masking timed out after 5 minutes' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    // Multipart photoshoot endpoint - forward FormData to /tools/agentic_photoshoot/run-multipart
    if (endpoint === '/tools/agentic_photoshoot/run-multipart' && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      const body = await req.arrayBuffer();
      
      // Always use STANDALONE_URL (port 8001) for multipart - not available through Temporal gateway
      console.log(`[workflow-proxy] Forwarding to ${STANDALONE_URL}/tools/agentic_photoshoot/run-multipart`);
      console.log(`[workflow-proxy] Content-Type: ${contentType}`);
      console.log(`[workflow-proxy] Body size: ${body.byteLength} bytes`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min

      try {
        const response = await fetch(`${STANDALONE_URL}/tools/agentic_photoshoot/run-multipart`, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
          },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[workflow-proxy] Multipart backend error: ${response.status} ${errorText}`);
          return new Response(
            JSON.stringify({ error: `Multipart photoshoot failed: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        console.log(`[workflow-proxy] Multipart success, response size: ${data.length} chars`);

        try {
          const parsed = JSON.parse(data);
          console.log(`[workflow-proxy] Multipart response keys:`, Object.keys(parsed));
        } catch (e) {
          // Not JSON
        }

        return new Response(data, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Multipart photoshoot timed out after 10 minutes' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw e;
      }
    }

    // Image validation API - forward to Temporal backend
    if (endpoint.startsWith('/api/validate/') && req.method === 'POST') {
      const body = await req.text();
      
      console.log(`[workflow-proxy] Forwarding validation to ${TEMPORAL_URL}${endpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 min

      try {
        const response = await fetch(`${TEMPORAL_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If validation service is down, return permissive response
        if (!response.ok) {
          console.warn(`[workflow-proxy] Validation service error: ${response.status}`);
          // Don't block uploads on validation failure
          return new Response(
            JSON.stringify({ 
              results: [],
              all_acceptable: true,
              flagged_count: 0,
              message: 'Validation service unavailable - proceeding without validation'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        console.log(`[workflow-proxy] Validation success, response size: ${data.length} chars`);

        return new Response(data, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn(`[workflow-proxy] Validation error:`, e);
        // Return permissive response on error
        return new Response(
          JSON.stringify({ 
            results: [],
            all_acceptable: true,
            flagged_count: 0,
            message: 'Validation error - proceeding without validation'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Image classification endpoint - forward to Temporal backend
    if (endpoint === '/tools/image_classification/run' && req.method === 'POST') {
      const body = await req.text();
      
      console.log(`[workflow-proxy] Forwarding classification to ${STANDALONE_URL}/tools/image_classification/run`);
      console.log(`[workflow-proxy] Body size: ${body.length} chars`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(`${STANDALONE_URL}/tools/image_classification/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[workflow-proxy] Classification service error: ${response.status}`);
          // Return permissive response - don't block uploads
          return new Response(
            JSON.stringify({ 
              category: 'unknown',
              is_worn: true,
              confidence: 0,
              reason: 'Classification service unavailable',
              flagged: false
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.text();
        console.log(`[workflow-proxy] Classification success, response: ${data.substring(0, 200)}`);

        return new Response(data, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timeoutId);
        console.warn(`[workflow-proxy] Classification error:`, e);
        // Return permissive response on timeout/error
        return new Response(
          JSON.stringify({ 
            category: 'unknown',
            is_worn: true,
            confidence: 0,
            reason: e instanceof Error && e.name === 'AbortError' 
              ? 'Classification timed out' 
              : 'Classification error',
            flagged: false
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[workflow-proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
