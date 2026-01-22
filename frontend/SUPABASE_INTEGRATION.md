# The Vault Club - Supabase Integration

## Overview

This frontend is connected to **Sequence Theory's Supabase project** (`qldjhlnsphlixmzzrdwi`).

- **Auth**: Uses Sequence Theory's Supabase Auth
- **Database**: Uses Sequence Theory's PostgreSQL database
- **Wallet Creation**: Triggers Sequence Theory's existing Turnkey Edge Function

## Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   The Vault Club        │     │   Sequence Theory       │
│   (This Frontend)       │     │   (Main Frontend)       │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            │   Same Supabase Project       │
            │   (qldjhlnsphlixmzzrdwi)      │
            ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │    Auth      │  │   Database   │  │ Edge Functions │ │
│  │  (Shared)    │  │   (Shared)   │  │   (Shared)    │ │
│  └──────────────┘  └──────────────┘  └───────────────┘ │
│                                              │          │
│                                              ▼          │
│                              ┌───────────────────────┐  │
│                              │ create-turnkey-wallet │  │
│                              │   (Turnkey API)       │  │
│                              └───────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## How Registration Works

1. **User signs up** on The Vault Club
2. **Supabase Auth** creates user in the shared auth system
3. **Auth service** triggers the `create-turnkey-wallet` Edge Function
4. **Edge Function** (deployed on Supabase by Sequence Theory) creates wallet via Turnkey
5. **Wallet stored** in shared `user_wallets` table

## Files

### `/src/services/authService.ts`
Lightweight wrapper that:
- Uses Supabase Auth (no new infrastructure)
- Triggers existing `create-turnkey-wallet` function
- Provides better error handling and logging

### `/src/integrations/supabase/client.ts`
Supabase client configured with Sequence Theory's project credentials.

### `/supabase/functions/create-turnkey-wallet/index.ts`
**Local template only** - the actual function runs on Supabase servers.
Used as reference for CORS configuration and Turnkey integration.

## CORS Configuration

For this site to work with Sequence Theory's Edge Functions, the `ALLOWED_ORIGINS` 
environment variable in Supabase must include:

```
https://ui-redesign-29.preview.emergentagent.com
```

**To configure:**
1. Go to Supabase Dashboard → Edge Functions → create-turnkey-wallet
2. Add environment variable: `ALLOWED_ORIGINS`
3. Value: `https://qldjhlnsphlixmzzrdwi.lovableproject.com,https://ui-redesign-29.preview.emergentagent.com,https://lovable.dev`

## Environment Variables

### Frontend (`/frontend/.env`)
```
VITE_SUPABASE_URL=https://qldjhlnsphlixmzzrdwi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
```

### Edge Function (Supabase Dashboard)
```
ALLOWED_ORIGINS=https://qldjhlnsphlixmzzrdwi.lovableproject.com,https://ui-redesign-29.preview.emergentagent.com
TURNKEY_ORGANIZATION_ID=<from_turnkey>
TURNKEY_API_PUBLIC_KEY=<from_turnkey>
TURNKEY_API_PRIVATE_KEY=<from_turnkey>
```

## Important Notes

1. **DO NOT** create duplicate auth systems or databases
2. **DO NOT** implement Turnkey logic locally - use the Edge Function
3. **DO NOT** modify Supabase URLs or keys without coordination with Sequence Theory
4. **Sequence Theory remains the single source of truth** for wallet creation

## Debugging

### Check Auth State
Open browser console and look for:
```
[AuthService] Starting registration for: user@example.com
[AuthService] User created: <user_id>
[AuthService] Triggering wallet creation via Sequence Theory...
[AuthService] Wallet creation successful: { address: "0x...", isNew: true }
```

### Common Issues

1. **CORS Error**: Add this site's domain to `ALLOWED_ORIGINS` in Supabase
2. **401 Unauthorized**: Check that auth token is being passed correctly
3. **Wallet not created**: Verify Turnkey credentials in Supabase Edge Function secrets
