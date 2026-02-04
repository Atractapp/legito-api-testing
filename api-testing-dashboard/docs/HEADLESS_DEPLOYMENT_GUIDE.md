# Headless Smart Annotator - Deployment Guide

This guide is for the IT department to deploy the Headless Smart Annotator service in a network-isolated environment.

## Overview

The Headless Smart Annotator is a self-contained HTTP service that:
- Accepts DOCX files via HTTP POST
- Returns annotated DOCX files with Legito placeholders
- Runs without any external network connections
- Uses rule-based detection (no AI/API calls)

## System Requirements

- **Runtime**: Node.js 22+ (LTS recommended)
- **Memory**: Minimum 512MB RAM, recommended 1GB
- **Disk**: 500MB for application + space for temporary files
- **Port**: 80 (configurable via PORT environment variable)

## Build Instructions

### Prerequisites

```bash
# Ensure Node.js 22+ is installed
node --version  # Should be v22.x.x or higher

# Navigate to project directory
cd api-testing-dashboard
```

### Build Steps

```bash
# Install dependencies
npm ci

# Build the application
npm run build

# The standalone output is in .next/standalone/
```

### Standalone Output Location

After building, the standalone application is at:
```
.next/standalone/
├── server.js          # Main entry point
├── .next/            # Compiled Next.js files
├── node_modules/     # Required dependencies (minimal)
└── package.json      # Package info
```

## Running the Service

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port to listen on |
| `HEADLESS_MODE` | `true` | Indicates headless deployment |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `PATTERNS_FILE_PATH` | `/app/data/patterns.json` | Path to patterns file |

### Start Command

```bash
# Set environment variables
export PORT=80
export HEADLESS_MODE=true
export HOSTNAME=0.0.0.0

# Run the server
node .next/standalone/server.js
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start .next/standalone/server.js --name "annotator" \
  --env PORT=80 \
  --env HEADLESS_MODE=true \
  --env HOSTNAME=0.0.0.0

# Save PM2 configuration
pm2 save
pm2 startup
```

## Pattern File Mount

### Location

The service expects patterns at:
```
/app/data/patterns.json
```

Or configure via `PATTERNS_FILE_PATH` environment variable.

### Mount Instructions (Docker/Kubernetes)

```bash
# Docker
docker run -v /host/path/patterns.json:/app/data/patterns.json ...

# Kubernetes ConfigMap
kubectl create configmap patterns --from-file=patterns.json
```

### Updating Patterns

1. Export new patterns using the export script (see `scripts/export-patterns-to-json.ts`)
2. Replace the patterns file
3. Restart the service (patterns are cached at startup)

## API Endpoints

### Health Check

```
GET /health
```

Returns:
- `200 OK` - Service is healthy
- `500 Internal Server Error` - Service is unhealthy

Response body:
```json
{
  "status": "healthy",
  "patternsLoaded": 10,
  "patternsFile": "/app/data/patterns.json",
  "version": "1.0.0",
  "timestamp": "2026-01-21T10:00:00.000Z"
}
```

### Annotate Document

```
POST /
Content-Type: multipart/form-data
```

Form field: `file` (DOCX file, max 10MB)

Returns:
- `200 OK` - Annotated DOCX file
- `422 Unprocessable Entity` - Invalid input
- `500 Internal Server Error` - Processing error

Success response headers:
```
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="annotated-{original}.docx"
X-Suggestions-Count: 15
X-Processing-Time-Ms: 234
X-Patterns-Loaded: 10
```

## Firewall Configuration (UFW)

For complete network isolation:

```bash
# Block all outgoing connections
sudo ufw default deny outgoing
sudo ufw default deny incoming

# Allow incoming on port 80 (HTTP)
sudo ufw allow in 80/tcp

# Allow loopback
sudo ufw allow in on lo
sudo ufw allow out on lo

# Enable firewall
sudo ufw enable
```

## Docker Deployment (Reference)

If you choose to use Docker:

```dockerfile
FROM node:22-slim

WORKDIR /app

# Copy standalone build
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY data ./data

# Set environment
ENV PORT=80
ENV HEADLESS_MODE=true
ENV HOSTNAME=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Run
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t annotator:latest .
docker run -d -p 80:80 -v /path/to/patterns.json:/app/data/patterns.json annotator:latest
```

## Health Check Integration

### Docker Compose
```yaml
services:
  annotator:
    image: annotator:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
```

### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /health
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Load Balancer
Configure health check to:
- Path: `/health`
- Expected status: `200`
- Interval: 30 seconds
- Timeout: 10 seconds

## Troubleshooting

### Service won't start

1. Check Node.js version: `node --version` (must be 22+)
2. Check port availability: `netstat -tlnp | grep 80`
3. Check permissions for patterns file

### Health check fails

1. Check logs: `pm2 logs annotator`
2. Verify patterns file exists and is valid JSON
3. Test locally: `curl http://localhost:80/health`

### Processing errors

1. Check input file is valid DOCX (not DOC)
2. Verify file size is under 10MB
3. Check server logs for detailed error messages

### Patterns not loading

1. Verify file path: `ls -la /app/data/patterns.json`
2. Check JSON validity: `cat /app/data/patterns.json | jq .`
3. Check environment variable: `echo $PATTERNS_FILE_PATH`

## Testing

### Local Testing

```bash
# Start the service
npm start

# Test health endpoint
curl http://localhost:3000/health

# Test annotation
curl -X POST -F "file=@test.docx" http://localhost:3000/ -o output.docx
```

### Production Verification

```bash
# Health check
curl -f http://annotator-host:80/health

# Annotate test file
curl -X POST \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test-document.docx" \
  http://annotator-host:80/ \
  -o annotated-output.docx

# Verify output
file annotated-output.docx
```

## Support

For issues with:
- **Deployment**: Contact IT infrastructure team
- **Patterns/Rules**: Contact development team
- **API usage**: Refer to API documentation

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-21 | Initial release |
