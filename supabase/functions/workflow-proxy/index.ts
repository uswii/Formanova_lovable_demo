import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DAG Workflow server endpoint
const WORKFLOW_URL = (Deno.env.get('WORKFLOW_API_URL') || 'http://20.173.91.22:8000').replace(/\/+$/, '');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || '/process';

    console.log(`[workflow-proxy] ${req.method} ${endpoint}`);

    // Health check
    if (endpoint === '/health') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${WORKFLOW_URL}/health`, {
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
      const response = await fetch(`${WORKFLOW_URL}/status/${workflowId}`, {
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
      const response = await fetch(`${WORKFLOW_URL}/result/${workflowId}`, {
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
      
      console.log(`[workflow-proxy] Forwarding to ${WORKFLOW_URL}/process`);
      console.log(`[workflow-proxy] Content-Type: ${contentType}`);
      console.log(`[workflow-proxy] Body size: ${body.byteLength} bytes`);

      // Use AbortController for 10 minute timeout (DAG workflows can be long)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min

      try {
        const response = await fetch(`${WORKFLOW_URL}/process`, {
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

    // Multipart photoshoot endpoint - forward FormData to /tools/agentic_photoshoot/run-multipart
    if (endpoint === '/tools/agentic_photoshoot/run-multipart' && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      const body = await req.arrayBuffer();
      
      console.log(`[workflow-proxy] Forwarding to ${WORKFLOW_URL}/tools/agentic_photoshoot/run-multipart`);
      console.log(`[workflow-proxy] Content-Type: ${contentType}`);
      console.log(`[workflow-proxy] Body size: ${body.byteLength} bytes`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min

      try {
        const response = await fetch(`${WORKFLOW_URL}/tools/agentic_photoshoot/run-multipart`, {
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
          console.log(`[workflow-proxy] Multipart response:`, {
            workflow_id: parsed.workflow_id,
            keys: Object.keys(parsed),
          });
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
