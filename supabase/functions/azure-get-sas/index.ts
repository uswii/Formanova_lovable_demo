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
    console.log('[azure-get-sas] Auth failed:', error?.message);
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
  console.log(`[azure-get-sas] Authenticated user: ${auth.userId}`);

  try {
    const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME');
    const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY');

    if (!AZURE_ACCOUNT_NAME || !AZURE_ACCOUNT_KEY) {
      console.error('Missing Azure configuration');
      return new Response(
        JSON.stringify({ error: 'Azure configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { azure_uri } = await req.json();

    if (!azure_uri || !azure_uri.startsWith('azure://')) {
      return new Response(
        JSON.stringify({ error: 'azure_uri is required and must start with azure://' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse azure://container/blob format
    const path = azure_uri.replace('azure://', '');
    const slashIndex = path.indexOf('/');
    if (slashIndex === -1) {
      return new Response(
        JSON.stringify({ error: 'Invalid azure_uri format. Expected: azure://container/blob' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const containerName = path.substring(0, slashIndex);
    const blobName = path.substring(slashIndex + 1);

    console.log(`Generating SAS URL for: ${containerName}/${blobName}`);

    // Generate SAS token (valid for 60 minutes)
    const sasToken = await generateSasToken(
      AZURE_ACCOUNT_NAME,
      AZURE_ACCOUNT_KEY,
      containerName,
      blobName,
      60
    );

    // Build the full SAS URL (don't encode the blob name as it may contain path segments)
    const httpsUrl = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${containerName}/${blobName}`;
    const sasUrl = `${httpsUrl}?${sasToken}`;
    
    console.log(`Generated SAS URL: ${httpsUrl}`);

    return new Response(
      JSON.stringify({ 
        sas_url: sasUrl,
        expires_in_minutes: 60
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Azure get-sas error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
