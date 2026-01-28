import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
};

// Auth service - use ngrok tunnel (direct IP times out from edge functions)
const AUTH_SERVICE_URL = 'https://interastral-joie-untough.ngrok-free.dev';

// Azure Blob Storage config
const AZURE_ACCOUNT_NAME = Deno.env.get('AZURE_ACCOUNT_NAME') || '';
const AZURE_ACCOUNT_KEY = Deno.env.get('AZURE_ACCOUNT_KEY') || '';
const AZURE_CONTAINER_NAME = Deno.env.get('AZURE_CONTAINER_NAME') || 'jewelry-uploads';

// Supabase config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Resend for email notifications
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAILS = ['uswa@raresense.so']; // Only owner email works with test domain

interface BatchImage {
  data_uri: string; // base64 data URI
  skin_tone?: string;
  classification?: {
    category: string;
    is_worn: boolean;
    flagged: boolean;
  };
}

interface BatchSubmitRequest {
  jewelry_category: 'necklace' | 'earring' | 'ring' | 'bracelet' | 'watch';
  notification_email?: string;
  images: BatchImage[];
}

interface UserInfo {
  id: string;
  email: string;
  display_name?: string;
}

// Authenticate request against custom auth service
async function authenticateRequest(req: Request): Promise<UserInfo | null> {
  const userToken = req.headers.get('X-User-Token');
  if (!userToken) {
    console.log('[batch-submit] Missing X-User-Token header');
    return null;
  }

  console.log('[batch-submit] Validating token against:', AUTH_SERVICE_URL);
  console.log('[batch-submit] Token prefix:', userToken.substring(0, 20) + '...');

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/users/me`, {
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'ngrok-skip-browser-warning': 'true',
      },
    });

    console.log('[batch-submit] Auth response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('[batch-submit] Token validation failed:', response.status, errorBody);
      return null;
    }

    const user = await response.json();
    console.log('[batch-submit] User authenticated:', user.email, 'ID:', user.id || user.sub);
    return {
      id: user.id || user.sub,
      email: user.email,
      display_name: user.display_name || user.name,
    };
  } catch (e) {
    console.error('[batch-submit] Auth service error:', e);
    return null;
  }
}

// Generate Azure SAS token for uploading
function generateSasToken(blobPath: string): string {
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  const signedPermissions = 'rcw'; // read, create, write
  const signedStart = now.toISOString().split('.')[0] + 'Z';
  const signedExpiry = expiry.toISOString().split('.')[0] + 'Z';
  const signedResource = 'b'; // blob
  const signedVersion = '2022-11-02';

  const canonicalizedResource = `/blob/${AZURE_ACCOUNT_NAME}/${AZURE_CONTAINER_NAME}/${blobPath}`;
  
  const stringToSign = [
    signedPermissions,
    signedStart,
    signedExpiry,
    canonicalizedResource,
    '', // signedIdentifier
    '', // signedIP
    '', // signedProtocol
    signedVersion,
    signedResource,
    '', // signedSnapshotTime
    '', // signedEncryptionScope
    '', // rscc
    '', // rscd
    '', // rsce
    '', // rscl
    '', // rsct
  ].join('\n');

  // HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const keyData = Uint8Array.from(atob(AZURE_ACCOUNT_KEY), c => c.charCodeAt(0));
  
  // Use Web Crypto API for HMAC
  const cryptoKey = crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // For sync operation, we'll use a simpler approach with direct upload
  return `sp=${signedPermissions}&st=${encodeURIComponent(signedStart)}&se=${encodeURIComponent(signedExpiry)}&spr=https&sv=${signedVersion}&sr=${signedResource}&sig=`;
}

// Upload image to Azure Blob Storage
async function uploadToAzure(
  dataUri: string,
  blobPath: string
): Promise<string> {
  // Extract base64 data from data URI
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URI format');
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Generate signature
  const now = new Date();
  const dateString = now.toUTCString();

  // Create authorization header using Shared Key
  const canonicalizedHeaders = `x-ms-blob-type:BlockBlob\nx-ms-date:${dateString}\nx-ms-version:2022-11-02`;
  const canonicalizedResource = `/${AZURE_ACCOUNT_NAME}/${AZURE_CONTAINER_NAME}/${blobPath}`;
  
  const stringToSign = [
    'PUT',
    '', // Content-Encoding
    '', // Content-Language
    binaryData.length.toString(), // Content-Length
    '', // Content-MD5
    contentType, // Content-Type
    '', // Date
    '', // If-Modified-Since
    '', // If-Match
    '', // If-None-Match
    '', // If-Unmodified-Since
    '', // Range
    canonicalizedHeaders,
    canonicalizedResource,
  ].join('\n');

  // Import key and sign
  const keyData = Uint8Array.from(atob(AZURE_ACCOUNT_KEY), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(stringToSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const blobUrl = `https://${AZURE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${blobPath}`;

  const response = await fetch(blobUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': binaryData.length.toString(),
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-date': dateString,
      'x-ms-version': '2022-11-02',
      'Authorization': `SharedKey ${AZURE_ACCOUNT_NAME}:${signature}`,
    },
    body: binaryData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[batch-submit] Azure upload failed:', response.status, errorText);
    throw new Error(`Azure upload failed: ${response.status}`);
  }

  console.log('[batch-submit] Uploaded to Azure:', blobPath);
  return blobUrl;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Authenticate user
    const user = await authenticateRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch-submit] User authenticated: ${user.email}`);

    // Parse request body
    const body: BatchSubmitRequest = await req.json();
    
    if (!body.jewelry_category || !body.images || body.images.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jewelry_category, images' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.images.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Maximum 10 images per batch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Generate batch ID
    const batchId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    console.log(`[batch-submit] Creating batch ${batchId} with ${body.images.length} images for user ${user.email}`);

    // Upload images to Azure and collect URLs
    const imageRecords: Array<{
      batch_id: string;
      sequence_number: number;
      original_url: string;
      skin_tone: string | null;
      classification_category: string | null;
      classification_is_worn: boolean | null;
      classification_flagged: boolean | null;
      status: string;
    }> = [];

    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      const blobPath = `batches/${user.id}/${batchId}/${timestamp}_${i + 1}.jpg`;
      
      try {
        const azureUrl = await uploadToAzure(img.data_uri, blobPath);
        
        imageRecords.push({
          batch_id: batchId,
          sequence_number: i + 1,
          original_url: azureUrl,
          skin_tone: img.skin_tone || null,
          classification_category: img.classification?.category || null,
          classification_is_worn: img.classification?.is_worn ?? null,
          classification_flagged: img.classification?.flagged ?? null,
          status: 'pending',
        });
      } catch (uploadError) {
        console.error(`[batch-submit] Failed to upload image ${i + 1}:`, uploadError);
        // Continue with other images
      }
    }

    if (imageRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to upload any images' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create batch_jobs record
    console.log(`[batch-submit] Inserting batch_jobs record:`, {
      id: batchId,
      user_id: user.id,
      user_email: user.email,
      jewelry_category: body.jewelry_category,
      total_images: imageRecords.length,
    });

    const { data: batchData, error: batchError } = await supabase
      .from('batch_jobs')
      .insert({
        id: batchId,
        user_id: user.id,
        user_email: user.email,
        user_display_name: user.display_name || null,
        jewelry_category: body.jewelry_category,
        notification_email: body.notification_email || user.email,
        total_images: imageRecords.length,
        status: 'pending',
      })
      .select();

    if (batchError) {
      console.error('[batch-submit] Failed to create batch_jobs record:', JSON.stringify(batchError));
      return new Response(
        JSON.stringify({ error: 'Failed to create batch record', details: batchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch-submit] batch_jobs record created:`, batchData);

    // Create batch_images records
    console.log(`[batch-submit] Inserting ${imageRecords.length} batch_images records`);
    
    const { data: imagesData, error: imagesError } = await supabase
      .from('batch_images')
      .insert(imageRecords)
      .select();

    if (imagesError) {
      console.error('[batch-submit] Failed to create batch_images records:', JSON.stringify(imagesError));
      // Cleanup: delete the batch_jobs record
      await supabase.from('batch_jobs').delete().eq('id', batchId);
      return new Response(
        JSON.stringify({ error: 'Failed to save image records', details: imagesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch-submit] batch_images records created:`, imagesData?.length);
    console.log(`[batch-submit] Batch ${batchId} created successfully with ${imageRecords.length} images`);

    // Send admin notification email (non-blocking)
    console.log('[batch-submit] RESEND_API_KEY present:', !!RESEND_API_KEY, 'length:', RESEND_API_KEY?.length || 0);
    
    if (RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #C9A55C;">🎉 New Batch Submitted!</h2>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Batch Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #666;">User:</td><td style="padding: 8px 0;"><strong>${user.display_name || user.email}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Email:</td><td style="padding: 8px 0;">${user.email}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Category:</td><td style="padding: 8px 0;"><strong style="text-transform: capitalize;">${body.jewelry_category}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Images:</td><td style="padding: 8px 0;"><strong>${imageRecords.length}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Batch ID:</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${batchId}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Time:</td><td style="padding: 8px 0;">${new Date().toLocaleString()}</td></tr>
              </table>
            </div>
            
            <a href="https://formanova.lovable.app/admin-batches?key=formanova-admin-2024" 
               style="display: inline-block; background: #C9A55C; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                View in Admin Dashboard
            </a>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px;">
                FormaNova - AI Jewelry Photography
            </p>
          </div>
        `;

        console.log('[batch-submit] Sending email to:', ADMIN_EMAILS);
        
        const { data, error } = await resend.emails.send({
          from: 'FormaNova <onboarding@resend.dev>',
          to: ADMIN_EMAILS,
          subject: `New Batch: ${user.email} submitted ${imageRecords.length} ${body.jewelry_category} images`,
          html: adminHtml,
        });

        if (error) {
          console.error('[batch-submit] Resend API error:', JSON.stringify(error));
        } else {
          console.log('[batch-submit] Email sent successfully, ID:', data?.id);
        }
      } catch (emailError) {
        console.error('[batch-submit] Failed to send admin notification email:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.log('[batch-submit] RESEND_API_KEY not configured, skipping admin notification');
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        image_count: imageRecords.length,
        message: `Batch submitted successfully. You'll receive an email at ${body.notification_email || user.email} when processing is complete.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[batch-submit] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
