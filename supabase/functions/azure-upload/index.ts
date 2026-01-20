import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Authentication helper - validates JWT and returns user ID
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) {
    console.log('[azure-upload] Auth failed:', error?.message);
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    };
  }

  return { userId: data.user.id };
}

// Generate SAS token for blob access
async function generateSasToken(
  accountName: string,
  accountKey: string,
  containerName: string,
  blobName: string,
  expiryMinutes: number = 60
): Promise<string> {
  const now = new Date();
  const expiry = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  
  // Format dates for SAS
  const formatDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const startTime = formatDate(now);
  const expiryTime = formatDate(expiry);
  
  // SAS parameters
  const signedPermissions = 'r'; // read only
  const signedService = 'b'; // blob
  const signedResourceType = 'b'; // blob
  const signedProtocol = 'https';
  const signedVersion = '2020-10-02';
  
  // String to sign for blob SAS
  const stringToSign = [
    signedPermissions,
    startTime,
    expiryTime,
    `/blob/${accountName}/${containerName}/${blobName}`,
    '', // signed identifier
    '', // signed IP
    signedProtocol,
    signedVersion,
    signedResourceType,
    '', // snapshot time
    '', // encryption scope
    '', // cache control
    '', // content disposition
    '', // content encoding
    '', // content language
    '', // content type
  ].join('\n');

  // Create HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(accountKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // Build SAS query string
  const sasParams = new URLSearchParams({
    sv: signedVersion,
    st: startTime,
    se: expiryTime,
    sr: signedResourceType,
    sp: signedPermissions,
    spr: signedProtocol,
    sig: signatureBase64,
  });

  return sasParams.toString();
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
  console.log(`[azure-upload] Authenticated user: ${auth.userId}`);

  try {
    const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME');
    const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY');
    // Azure container names must be lowercase
    const AZURE_CONTAINER_NAME = Deno.env.get('AZURE_CONTAINER_NAME')?.toLowerCase();

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

    // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
    let cleanBase64 = base64;
    if (base64.includes(',')) {
      cleanBase64 = base64.split(',')[1];
    }

    // Generate unique blob name with user ID prefix for organization
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = content_type?.includes('png') ? 'png' : 'jpg';
    const blobName = filename || `${auth.userId}/${timestamp}_${random}.${extension}`;

    // Decode base64 to binary
    const binaryData = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));

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

    // Generate SAS token for the uploaded blob (valid for 60 minutes)
    const sasToken = await generateSasToken(
      AZURE_ACCOUNT_NAME,
      AZURE_ACCOUNT_KEY,
      AZURE_CONTAINER_NAME,
      blobName,
      60
    );
    
    // Create SAS URL for private blob access
    const sasUrl = `${url}?${sasToken}`;

    // Return azure:// format as primary (microservices expect this format and have their own Azure creds)
    // Also include SAS URL for direct browser/client access to private blobs
    const azureUri = `azure://${AZURE_CONTAINER_NAME}/${blobName}`;
    console.log(`Upload successful: ${azureUri}`);

    return new Response(
      JSON.stringify({ 
        uri: azureUri,  // Primary: azure:// format for microservices
        sas_url: sasUrl,  // SAS URL for direct client access to private blobs
        https_url: url  // Plain HTTPS URL (won't work for private containers without SAS)
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
