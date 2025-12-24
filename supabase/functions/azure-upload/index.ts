import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME');
    const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY');
    const AZURE_CONTAINER_NAME = Deno.env.get('AZURE_CONTAINER_NAME');

    console.log('Azure config:', { 
      account: AZURE_ACCOUNT_NAME, 
      container: AZURE_CONTAINER_NAME,
      hasKey: !!AZURE_ACCOUNT_KEY 
    });

    if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY || !AZURE_CONTAINER_NAME) {
      console.error('Missing Azure configuration');
      return new Response(
        JSON.stringify({ error: 'Azure configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { base64, filename, content_type } = await req.json();

    if (!base64) {
      return new Response(
        JSON.stringify({ error: 'base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique blob name (flat structure - no subdirectories to avoid path issues)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = content_type?.includes('png') ? 'png' : 'jpg';
    const blobName = filename || `${timestamp}_${random}.${extension}`;

    // Decode base64 to binary
    const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    // Azure Blob Storage REST API - URL encode the blob name for the request
    const encodedBlobName = encodeURIComponent(blobName);
    const url = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${encodedBlobName}`;
    const dateStr = new Date().toUTCString();
    const blobType = 'BlockBlob';
    const contentLength = binaryData.length;
    const blobContentType = content_type || 'image/jpeg';

    // Create signature for Azure authentication
    const stringToSign = [
      'PUT',
      '', // Content-Encoding
      '', // Content-Language
      contentLength.toString(), // Content-Length
      '', // Content-MD5
      blobContentType, // Content-Type
      '', // Date
      '', // If-Modified-Since
      '', // If-Match
      '', // If-None-Match
      '', // If-Unmodified-Since
      '', // Range
      // CanonicalizedHeaders
      `x-ms-blob-type:${blobType}`,
      `x-ms-date:${dateStr}`,
      `x-ms-version:2020-10-02`,
      // CanonicalizedResource
      `/${AZURE_ACCOUNT_NAME}/${AZURE_CONTAINER_NAME}/${blobName}`,
    ].join('\n');

    // Create HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const keyData = Uint8Array.from(atob(AZURE_ACCOUNT_KEY), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const authHeader = `SharedKey ${AZURE_ACCOUNT_NAME}:${signatureBase64}`;

    console.log(`Uploading to Azure: ${blobName} (${contentLength} bytes)`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'x-ms-date': dateStr,
        'x-ms-version': '2020-10-02',
        'x-ms-blob-type': blobType,
        'Content-Type': blobContentType,
        'Content-Length': contentLength.toString(),
      },
      body: binaryData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure upload failed:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Azure upload failed', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return URI in azure:// format that microservices expect
    const azureUri = `azure://${AZURE_CONTAINER_NAME}/${blobName}`;
    console.log(`Upload successful: ${azureUri} (https: ${url})`);

    return new Response(
      JSON.stringify({ 
        uri: azureUri,
        https_url: url  // Also return HTTPS URL for direct access if needed
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Azure upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
