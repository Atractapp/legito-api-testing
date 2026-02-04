# SSO Worker

Express server that runs Playwright SSO tests via Browserless CDP connection.

## Architecture

```
Dashboard (Vercel) -> SSO Worker (Railway) -> Browserless (Railway) -> Legito SSO
```

## Railway Deployment

### Step 1: Deploy Browserless

1. Go to Railway Dashboard
2. Click "New Project" -> "Deploy a Template"
3. Search for "browserless" and deploy it
4. Note the public URL (e.g., `browserless-production.up.railway.app`)

### Step 2: Deploy SSO Worker

1. In Railway, add a new service from this folder
2. Railway will auto-detect Node.js and build

### Step 3: Configure Environment Variables

In Railway, set these for the SSO Worker:

```bash
# Browserless connection
BROWSER_PLAYWRIGHT_ENDPOINT=wss://browserless-production.up.railway.app
BROWSER_TOKEN=<from-browserless-service>

# SSO credentials
SSO_TEST_EMAIL=<your-sso-test-email>
SSO_TEST_PASSWORD=<your-sso-test-password>

# Notifications & Database
SLACK_WEBHOOK_URL=<your-slack-webhook-url>
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_KEY=<your-service-key>
```

### Step 4: Update Dashboard

In Vercel (dashboard), add:

```bash
SSO_WORKER_URL=https://sso-worker-production.up.railway.app
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run Browserless locally (Docker):
   ```bash
   docker run -p 3000:3000 ghcr.io/browserless/chromium
   ```

3. Create `.env`:
   ```bash
   BROWSER_PLAYWRIGHT_ENDPOINT=ws://localhost:3000
   SSO_TEST_EMAIL=<your-sso-test-email>
   SSO_TEST_PASSWORD=<your-sso-test-password>
   SUPABASE_URL=<your-url>
   SUPABASE_SERVICE_KEY=<your-key>
   ```

4. Run worker:
   ```bash
   npm run dev
   ```

## API Endpoints

### GET /health
Health check with environment status.

### POST /test
Trigger an SSO test.

Request:
```json
{
  "testId": "uuid",
  "serverId": "emea",
  "serverUrl": "https://ssotesting.emea.legito.com"
}
```

Response:
```json
{
  "accepted": true,
  "testId": "uuid"
}
```

The test runs asynchronously and updates Supabase directly.
