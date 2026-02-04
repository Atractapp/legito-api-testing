# SSO Testing Instructions

Automated Azure SSO login testing for Legito environments.

## Dashboard

**URL:** https://api-testing-dashboard.vercel.app/sso

Use the dashboard to:
- View test results and history
- Manually trigger tests via UI
- Monitor server status

---

## API for Server Admins

Use these commands to trigger SSO tests after deployments or releases.

### Authentication

All API requests require the `X-API-Key` header:

```
X-API-Key: sso_c16b47525f39764e5f691d58bb636738ac90e0a01de4828a
```

### Available Servers

| Server ID | Name | URL |
|-----------|------|-----|
| `emea` | EMEA | https://ssotesting.emea.legito.com |
| `us` | US | https://ssotesting.us.legito.com |
| `quarterly` | Quarterly | https://ssotesting.quarterly.legito.com |

---

## Trigger Tests

### Single Server

**EMEA:**
```bash
curl -X POST https://api-testing-dashboard.vercel.app/api/sso/trigger -H "Content-Type: application/json" -H "X-API-Key: sso_c16b47525f39764e5f691d58bb636738ac90e0a01de4828a" -d '{"serverId":"emea","triggeredBy":"webhook"}'
```

**US:**
```bash
curl -X POST https://api-testing-dashboard.vercel.app/api/sso/trigger -H "Content-Type: application/json" -H "X-API-Key: sso_c16b47525f39764e5f691d58bb636738ac90e0a01de4828a" -d '{"serverId":"us","triggeredBy":"webhook"}'
```

**Quarterly:**
```bash
curl -X POST https://api-testing-dashboard.vercel.app/api/sso/trigger -H "Content-Type: application/json" -H "X-API-Key: sso_c16b47525f39764e5f691d58bb636738ac90e0a01de4828a" -d '{"serverId":"quarterly","triggeredBy":"webhook"}'
```

### All Servers (Bash)

```bash
for server in emea us quarterly; do curl -X POST https://api-testing-dashboard.vercel.app/api/sso/trigger -H "Content-Type: application/json" -H "X-API-Key: sso_c16b47525f39764e5f691d58bb636738ac90e0a01de4828a" -d "{\"serverId\":\"$server\",\"triggeredBy\":\"webhook\"}"; echo; done
```

---

## Check Results

### Get Recent Results

```bash
curl "https://api-testing-dashboard.vercel.app/api/sso/results?limit=10"
```

### Get Server Status

```bash
curl "https://api-testing-dashboard.vercel.app/api/sso/status?serverId=emea"
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "testId": "uuid-here",
  "message": "Test triggered for EMEA"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Missing X-API-Key header"
}
```

---

## Slack Notifications

Test results are automatically posted to Slack:

- ✅ **PASSED:** Green notification with duration
- ❌ **FAILED:** Red notification with error details

---

## Troubleshooting

### "Missing X-API-Key header"

- Ensure the command is on a **single line** (no line breaks)
- Check for hidden characters if copy/pasting
- Verify the API key is correct

### Test stuck on "Running"

- Tests typically complete in 5-10 seconds
- Check the dashboard for actual status
- If stuck, refresh the page

### Connection errors

- Verify the server URL is accessible
- Check if the SSO login page has changed
- Review error details in the dashboard

---

## Health Check Endpoint

Automated health check that tests all servers and returns overall status.

**URL:** `https://api-testing-dashboard.vercel.app/api/sso/health-6b8337d6915276df9fef376cd8522cff`

```bash
curl https://api-testing-dashboard.vercel.app/api/sso/health-6b8337d6915276df9fef376cd8522cff
```

**Response (200 OK - all passed):**
```json
{
  "healthy": true,
  "message": "All SSO tests passed",
  "timestamp": "2026-02-04T15:00:00.000Z",
  "totalDurationMs": 18500,
  "results": {
    "emea": { "server": "EMEA", "success": true, "status": "success", "durationMs": 5200 },
    "us": { "server": "US", "success": true, "status": "success", "durationMs": 6100 },
    "quarterly": { "server": "Quarterly", "success": true, "status": "success", "durationMs": 4800 }
  }
}
```

**Response (503 - failure):**
```json
{
  "healthy": false,
  "message": "One or more SSO tests failed",
  "results": {
    "emea": { "success": false, "status": "failure", "error": "Timeout waiting for login" }
  }
}
```

---

## Support

- **Dashboard:** https://api-testing-dashboard.vercel.app/sso
- **Railway Project:** https://railway.com/project/551cdb12-a368-4ff9-9465-008f659f2d9a
