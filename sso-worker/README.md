# SSO Worker

Express HTTP server that runs SSO login tests via Playwright connecting to Browserless via CDP.

## Architecture

```
Dashboard (Vercel) --> Worker (Railway) --> Browserless (Railway)
                           |
                           v
                      Supabase (DB)
                           |
                           v
                       Slack
```

## Deployment to Railway

### Step 1: Deploy Browserless

1. Go to https://railway.app/new
2. Search for "browserless" template
3. Click deploy - it will automatically set up the browser service
4. Note the internal URL (e.g., `browserless.railway.internal`)

### Step 2: Deploy SSO Worker

1. Create new service in the same Railway project
2. Connect this `sso-worker/` folder as the source
3. Set environment variables (see below)
4. Deploy

### Step 3: Configure Environment Variables

In Railway's SSO Worker service settings, add:

```
# Browserless (use internal Railway networking)
BROWSER_PLAYWRIGHT_ENDPOINT=wss://browserless.railway.internal:3000
BROWSER_TOKEN=<from-browserless-service>

# SSO credentials
SSO_TEST_EMAIL=<your-sso-email>
SSO_TEST_PASSWORD=<your-sso-password>

# Slack webhook
SLACK_WEBHOOK_URL=<your-slack-webhook-url>

# Supabase
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_KEY=<your-service-key>
```

### Step 4: Update Vercel

Add the worker URL to your Vercel environment:

```
SSO_WORKER_URL=https://sso-worker-production.up.railway.app
```

## Local Development

1. Copy `.env.example` to `.env`
2. Fill in the values
3. Run: `npm install && npm run dev`

## API Endpoints

### Health Check
```
GET /health

Response: {
  "status": "healthy",
  "version": "1.0.0",
  "activeTests": 0,
  "timestamp": "2026-02-04T..."
}
```

### Trigger Test
```
POST /test
Body: {
  "testId": "uuid",
  "serverId": "emea" | "us" | "quarterly",
  "serverUrl": "https://ssotesting.emea.legito.com"
}

Response: {
  "success": true,
  "message": "Test started",
  "testId": "uuid"
}
```

### Get Test Status
```
GET /test/:testId

Response: {
  "testId": "uuid",
  "isActive": true/false,
  "status": "running" | "success" | "failure" | "error",
  ...
}
```

### List Active Tests
```
GET /tests/active

Response: {
  "count": 1,
  "testIds": ["uuid"]
}
```

## Notes

- Tests run asynchronously - the `/test` endpoint returns immediately
- Results are written to Supabase `sso_test_results` table
- Slack notifications are sent on test completion
- Screenshots are captured on failures (base64 stored in metadata)

## Troubleshooting

### Connection Issues
- Check `BROWSER_PLAYWRIGHT_ENDPOINT` is correct
- Ensure Browserless service is running
- Check Railway networking (use internal URLs)

### Login Failures
- Verify SSO credentials are correct
- Check if login page selectors have changed
- Review error screenshots in database metadata

### Timeouts
- Default timeout is 60s for navigation
- Microsoft login can be slow - increase if needed
- Check Browserless resources (memory, CPU)
