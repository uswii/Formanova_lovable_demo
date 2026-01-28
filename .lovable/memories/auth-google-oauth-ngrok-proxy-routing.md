# Memory: auth/google-oauth-ngrok-proxy-routing
Updated: 2025-01-28

## OAuth Flow Architecture

The Google OAuth flow uses a proxy chain to avoid CORS and connectivity issues:

```
Frontend (formanova.lovable.app)
    ↓ fetch
Edge Function (auth-proxy)
    ↓ fetch + ngrok-skip-browser-warning header
ngrok tunnel (interastral-joie-untough.ngrok-free.dev)
    ↓
FastAPI Auth Service (port 8002)
```

## Key Configuration

### Edge Function (`supabase/functions/auth-proxy/index.ts`)
- `AUTH_SERVICE_URL = 'https://interastral-joie-untough.ngrok-free.dev'`
- All requests include `'ngrok-skip-browser-warning': 'true'` header
- Direct IP (`http://20.157.122.64:8002`) times out from Supabase edge functions

### Frontend (`src/pages/Auth.tsx`)
- Uses edge function proxy: `${SUPABASE_URL}/functions/v1/auth-proxy/auth/google/authorize`
- Cannot call ngrok directly due to CORS restrictions

## Why This Works
- Edge functions make server-to-server requests (no CORS)
- ngrok tunnel provides HTTPS endpoint for Google OAuth redirect_uri
- Frontend talks to trusted Supabase domain (no CSP issues)

## Requirements
- ngrok tunnel must stay running on backend server
- ngrok URL must match Google OAuth redirect_uri in Google Cloud Console
