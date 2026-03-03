# ShipHero API Token Configuration Guide

## Quick Reference for Next Time

### The Problem
The `.env` file had the Firebase CLI command mixed in with the actual token:
```
❌ WRONG:
VITE_SHIPHERO_API_TOKEN=firebase functions:config:set shiphero.api_token="eyJhbGciOiJSUzI1NiIs..."
```

### The Solution

#### 1. Frontend Configuration (`.env` file)
**File:** `dashboard/.env`

**Correct format:**
```
VITE_SHIPHERO_API_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJUQXlOVU13T0Rrd09ETXhSVVZDUXpBNU5rSkVOVVUxUmtNeU1URTRNMEkzTWpnd05ERkdNdyJ9.eyJodHRwOi8vc2hpcGhlcm8tcHVibGljLWFwaS91c2VyaW5mbyI6eyJhY2NvdW50X2lkIjo4MzE4MiwiY2xpZW50X25hbWUiOiJTaGlwaGVybyBQdWJsaWMgQVBJIEdhdGV3YXkiLCJkYXRhIjp7fSwiZW1haWwiOiJpdEBlY29zaGlwLmNvbSIsImZpcnN0X25hbWUiOiJFY29TaGlwICIsImlkIjoibXRjYndxSTJyNjEzRGNPTjNEYlVhSExxUXpRNGRraG4iLCJsYXN0X25hbWUiOiJJVCIsIm5hbWUiOiJFY29TaGlwICBJVCIsIm5pY2tuYW1lIjoiaXQiLCJvcmlnaW5fYXBwIjoidW5rbm93biIsInBpY3R1cmUiOiJodHRwczovL3MuZ3JhdmF0YXIuY29tL2F2YXRhci8xZGFiNDNiY2JmZTZmMjE2M2E1ZGJkMjYzYjFiMmYxNT9zPTQ4MCZyPXBnJmQ9aHR0cHMlM0ElMkYlMkZjZG4uYXV0aDAuY29tJTJGYXZhdGFycyUyRmVpLnBuZyJ9LCJpc3MiOiJodHRwczovL2xvZ2luLnNoaXBoZXJvLmNvbS8iLCJzdWIiOiJhdXRoMHw2Nzc3ZGZiMTU3ZWVhMjM5NWFmYWM0ZjgiLCJhdWQiOlsic2hpcGhlcm8tcHVibGljLWFwaSJdLCJpYXQiOjE3NTg5MTQxNjEsImV4cCI6MTc2MTMzMzM2MSwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSB2aWV3OnByb2R1Y3RzIGNoYW5nZTpwcm9kdWN0cyB2aWV3Om9yZGVycyBjaGFuZ2U6b3JkZXJzIHZpZXc6cHVyY2hhc2Vfb3JkZXJzIGNoYW5nZTpwdXJjaGFzZV9vcmRlcnMgdmlldzpzaGlwbWVudHMgY2hhbmdlOnNoaXBtZW50cyB2aWV3OnJldHVybnMgY2hhbmdlOnJldHVybnMgdmlldzp3YXJlaG91c2VfcHJvZHVjdHMgY2hhbmdlOndhcmVob3VzZV9wcm9kdWN0cyB2aWV3OnBpY2tpbmdfc3RhdHMgdmlldzpwYWNraW5nX3N0YXRzIG9mZmxpbmVfYWNjZXNzIiwiZ3R5IjpbInJlZnJlc2hfdG9rZW4iLCJwYXNzd29yZCJdLCJhenAiOiJtdGNid3FJMnI2MTNEY09OM0RiVWFITHFRelE0ZGtobiJ9.R1K5pRwVwUM0YgIVLqOR2vw4lbPXRmBX1ZkQsW_7QDhL3pUGNU5LYJzsUD3kcOdB00CTXD3gOmlq21MAEP5HTCffV7bT-MhhoAzcdYy3Lt-b35kIk21YJu3OR3yXxneGLbUBE_xbeQh9SyzMUcd88MXWhZJfWEyzVOsIgV26j11qPtAcm-pUHHSj-TbsJKuDeFDZkMSWCD4P66piUq2I-Wi3hZYbh35h64vgqrDe4Cgq0M6xyw2O3WcG57PoboGJYxwxs9YGpUYFPG8C8SGpdGxSl2UjAU9049rq6sLz4uuP-SqZcR-NR1Tc1HEDnuIrcA-PdWkkPVyYPwICR3LPfw
```

**Key points:**
- Just the JWT token value
- No Firebase CLI command
- No quotes around the token
- No `firebase functions:config:set` part

#### 2. Backend Configuration (Firebase Functions / Secret Manager)

Backend config is stored in Google Cloud Secret Manager as `FUNCTIONS_CONFIG_EXPORT2` (JSON). Functions use `defineJsonSecret` to read it—no more `firebase functions:config`.

**To update the ShipHero token in the backend:**

1. **Get the current JSON**  
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → Secret Manager → `FUNCTIONS_CONFIG_EXPORT2` → open the latest version and copy the value.

2. **Edit the JSON**  
   - Update the `shiphero.api_token` field:
   ```json
   {
     "shiphero": { "api_token": "YOUR_NEW_TOKEN_HERE" },
     "bigquery": { ... },
     "slack": { ... }
   }
   ```

3. **Create a new secret version**  
   - In Secret Manager → `FUNCTIONS_CONFIG_EXPORT2` → **New version**  
   - Paste the updated JSON and save.

   - Or via `gcloud`:
   ```bash
   echo '{"shiphero":{"api_token":"YOUR_NEW_TOKEN"},"bigquery":{...},"slack":{...}}' > config.json
   gcloud secrets versions add FUNCTIONS_CONFIG_EXPORT2 --data-file=config.json
   ```

4. **No redeploy needed**  
   Functions read the secret on cold start, so they will use the new value on the next invocation.

**Key points:**
- Keep the full JSON structure; only change `shiphero.api_token`.
- Ensure valid JSON (no trailing commas, proper escaping).

### Testing the Configuration

#### Test Frontend Connection
```bash
# Set environment variable (PowerShell)
$env:VITE_SHIPHERO_API_TOKEN="your_token_here"
node test-shiphero-connection.js
```

#### Test Backend Configuration
- Trigger a backend function (e.g. Sync with ShipHero, process queue) and check that ShipHero calls succeed.
- Or inspect `FUNCTIONS_CONFIG_EXPORT2` in Secret Manager to confirm the JSON structure.

### Why Both Are Needed

1. **Frontend** (`.env` file) - Used by React app for direct API calls to ShipHero
2. **Backend** (Secret Manager `FUNCTIONS_CONFIG_EXPORT2`) - Used by Cloud Functions for server-side API calls

### Common Mistakes to Avoid

1. ❌ **Don't copy Firebase CLI commands or secret JSON into `.env` file**
2. ❌ **Don't forget to preserve the full JSON structure when updating the secret** (shiphero, bigquery, slack, etc.)
3. ❌ **Don't forget to add a new secret version** (editing in the console creates a new version automatically)
4. ❌ **Don't mix up the two different configurations** (frontend `.env` vs backend secret)

### When to Update

- When ShipHero API token expires (usually every few months)
- When getting "failed to contact shiphero" errors
- When ShipHero API calls start failing

### Quick Fix Checklist

1. ✅ Update `dashboard/.env` file with new token (just the raw JWT)
2. ✅ In GCP Secret Manager, add a new version of `FUNCTIONS_CONFIG_EXPORT2` with updated `shiphero.api_token`
3. ✅ Test frontend with `node test-shiphero-connection.js`
4. ✅ Restart development server for frontend changes

---

**Created:** January 2025  
**Last Updated:** January 2025  
**Purpose:** Quick reference for ShipHero API token configuration




