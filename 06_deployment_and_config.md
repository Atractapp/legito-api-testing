# API Testing Platform - Deployment & Configuration Guide

## Environment Configuration

### Development Environment

```env
# .env.development.local

# Supabase Configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=postgres

# API Configuration
LEGITO_API_BASE_URL=https://api.legito.com
LEGITO_API_TIMEOUT_MS=30000

# Context Management
CONTEXT_CACHE_TTL_MS=86400000  # 24 hours
MAX_CONTEXT_SIZE_BYTES=10485760  # 10MB
MAX_SHARED_VARIABLES=1000
MAX_CAPTURED_DATA=5000

# Performance Settings
CONTEXT_CLEANUP_INTERVAL_MS=21600000  # 6 hours
PERFORMANCE_AGGREGATION_INTERVAL_MS=3600000  # 1 hour

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

### Production Environment

```env
# .env.production

# Supabase Configuration (via Vercel secrets)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

# Redis Cache (for distributed deployments)
REDIS_URL=redis://cache.service:6379
REDIS_DB=0
REDIS_TTL_MS=86400000

# API Configuration
LEGITO_API_BASE_URL=https://api.legito.com
LEGITO_API_TIMEOUT_MS=30000
LEGITO_API_RETRY_COUNT=3

# Context Management (conservative limits for production)
CONTEXT_CACHE_TTL_MS=86400000
MAX_CONTEXT_SIZE_BYTES=5242880  # 5MB limit
MAX_SHARED_VARIABLES=500
MAX_CAPTURED_DATA=2000

# Performance Settings
CONTEXT_CLEANUP_INTERVAL_MS=43200000  # 12 hours
PERFORMANCE_AGGREGATION_INTERVAL_MS=1800000  # 30 minutes

# Security
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_PER_MINUTE=1000
RATE_LIMIT_PER_HOUR=50000

# Storage
S3_BUCKET=api-testing-archive
S3_REGION=us-east-1
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
```

---

## Database Setup & Migrations

### Initial Setup

```bash
# 1. Create Supabase project
supabase projects create --name "api-testing-platform"

# 2. Get project ID and credentials
export SUPABASE_PROJECT_ID="your-project-id"
export SUPABASE_API_KEY="your-api-key"

# 3. Initialize Supabase locally
supabase start

# 4. Apply schema
psql -h localhost -U postgres -d postgres -f 01_database_schema.sql

# 5. Seed initial data
psql -h localhost -U postgres -d postgres -f seeds/initial_data.sql

# 6. Verify setup
psql -h localhost -U postgres -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';"
```

### Migration Management

```bash
# Create new migration
supabase migration new add_new_column

# Apply pending migrations
supabase db push

# View migration history
supabase migration list

# Rollback last migration
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > src/database.types.ts
```

### Backup & Recovery

```bash
# Create backup
pg_dump -h localhost -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -h localhost -U postgres -d postgres < backup_20240101_120000.sql

# Verify backup integrity
pg_restore -l backup_20240101_120000.sql | head -20
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build
RUN npm prune --production

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: api-testing-db
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: api_testing
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./01_database_schema.sql:/docker-entrypoint-initdb.d/schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: api-testing-cache
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # API Testing Service
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: api-testing-app
    environment:
      SUPABASE_URL: http://localhost:54321
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./src:/app/src
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

### Deploy with Docker Compose

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Clean up volumes
docker-compose down -v
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: api-testing

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: api-testing
data:
  LEGITO_API_BASE_URL: "https://api.legito.com"
  LOG_LEVEL: "info"
  CONTEXT_CACHE_TTL_MS: "86400000"

---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: api-testing
type: Opaque
stringData:
  SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
  SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
  ENCRYPTION_KEY: ${ENCRYPTION_KEY}
  REDIS_URL: redis://redis:6379

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-testing-app
  namespace: api-testing
  labels:
    app: api-testing
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-testing
  template:
    metadata:
      labels:
        app: api-testing
    spec:
      containers:
      - name: api-testing
        image: your-registry/api-testing:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: SUPABASE_URL
          value: ${SUPABASE_URL}
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - api-testing
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: api-testing-service
  namespace: api-testing
spec:
  selector:
    app: api-testing
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-testing-hpa
  namespace: api-testing
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-testing-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Deploy to Kubernetes

```bash
# Create namespace and deploy
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml

# Check deployment status
kubectl get deployments -n api-testing
kubectl get pods -n api-testing
kubectl get svc -n api-testing

# View logs
kubectl logs -n api-testing -l app=api-testing -f

# Scale deployment
kubectl scale deployment api-testing-app -n api-testing --replicas=5

# Rolling update
kubectl set image deployment/api-testing-app -n api-testing \
  api-testing=your-registry/api-testing:v2

# Rollback
kubectl rollout undo deployment/api-testing-app -n api-testing
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy API Testing Platform

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run type check
      run: npm run typecheck

    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/api_testing

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/api_testing

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Build application
      run: npm run build

    - name: Login to Docker Registry
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}

    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          ${{ secrets.DOCKER_USERNAME }}/api-testing:${{ github.sha }}
          ${{ secrets.DOCKER_USERNAME }}/api-testing:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v3

    - name: Deploy to Kubernetes
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > ~/.kube/config
        kubectl set image deployment/api-testing-app -n api-testing \
          api-testing=${{ secrets.DOCKER_USERNAME }}/api-testing:${{ github.sha }}
        kubectl rollout status deployment/api-testing-app -n api-testing --timeout=5m

    - name: Notify Slack
      if: success()
      uses: slackapi/slack-github-action@v1.24.0
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "API Testing Platform deployed successfully",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "✅ API Testing Platform\n*Deployed successfully*\n<${{ github.server_url }}/${{ github.repository }}/commit/${{ github.sha }}|View commit>"
                }
              }
            ]
          }
```

---

## Monitoring & Alerting

### Prometheus Metrics Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-testing'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "API Testing Platform",
    "panels": [
      {
        "title": "Test Execution Rate",
        "targets": [
          {
            "expr": "rate(test_executions_total[5m])"
          }
        ]
      },
      {
        "title": "Test Pass Rate",
        "targets": [
          {
            "expr": "rate(test_results_passed[5m]) / rate(test_results_total[5m]) * 100"
          }
        ]
      },
      {
        "title": "Average Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(response_time_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Context Cache Hit Rate",
        "targets": [
          {
            "expr": "rate(context_cache_hits[5m]) / (rate(context_cache_hits[5m]) + rate(context_cache_misses[5m])) * 100"
          }
        ]
      },
      {
        "title": "Database Connection Pool",
        "targets": [
          {
            "expr": "postgres_stat_activity_count"
          }
        ]
      }
    ]
  }
}
```

### Alert Rules

```yaml
# alerts.yml
groups:
  - name: api_testing_alerts
    rules:
      - alert: HighFailureRate
        expr: rate(test_results_failed[5m]) / rate(test_results_total[5m]) > 0.2
        for: 5m
        annotations:
          summary: "High test failure rate ({{ $value | humanizePercentage }})"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(response_time_seconds_bucket[5m])) > 2
        for: 5m
        annotations:
          summary: "High response time ({{ $value }}s)"

      - alert: ContextCacheLow
        expr: context_cache_hit_rate < 0.5
        for: 10m
        annotations:
          summary: "Context cache hit rate below 50%"

      - alert: DatabaseConnectionsHigh
        expr: postgres_stat_activity_count > 80
        for: 5m
        annotations:
          summary: "Database connections approaching limit"

      - alert: ContextSizeWarning
        expr: context_max_size_bytes > 8388608
        annotations:
          summary: "Context approaching size limit"
```

---

## Backup & Disaster Recovery

### Automated Backup Strategy

```bash
#!/bin/bash
# backup.sh - Daily backup script

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/api-testing"
S3_BUCKET="s3://api-testing-backups"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/db_$TIMESTAMP.sql

# Compress
gzip $BACKUP_DIR/db_$TIMESTAMP.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/db_$TIMESTAMP.sql.gz $S3_BUCKET/

# Keep local backups for 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

# Log
echo "Backup completed: db_$TIMESTAMP.sql.gz" >> $BACKUP_DIR/backup.log
```

### Disaster Recovery Procedure

```bash
#!/bin/bash
# restore.sh - Disaster recovery script

BACKUP_FILE=$1
DB_HOST="postgres.production"
DB_USER="postgres"
DB_NAME="api_testing"

# Download from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
  aws s3 cp $BACKUP_FILE .
  BACKUP_FILE=$(basename $BACKUP_FILE)
fi

# Decompress
gunzip $BACKUP_FILE

# Stop application
kubectl scale deployment api-testing-app -n api-testing --replicas=0

# Restore database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < ${BACKUP_FILE%.gz}

# Verify restore
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM test_runs;"

# Restart application
kubectl scale deployment api-testing-app -n api-testing --replicas=3

echo "Restore completed successfully"
```

---

## Performance Tuning

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM test_results
WHERE run_id = $1 AND created_at > NOW() - INTERVAL '7 days';

-- Update table statistics
ANALYZE test_results;
ANALYZE performance_metrics;

-- Reindex fragmented indexes
REINDEX INDEX idx_test_results_run_id;
REINDEX INDEX idx_performance_metrics_lookup;

-- Vacuum to reclaim space
VACUUM ANALYZE test_results;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Cache Optimization

```typescript
// Redis caching configuration
const cacheConfig = {
  // Context cache
  context: {
    ttl: 24 * 60 * 60, // 24 hours
    keyPrefix: 'context:',
    maxSize: 10 * 1024 * 1024, // 10MB
  },

  // Query result cache
  queries: {
    ttl: 60 * 60, // 1 hour
    keyPrefix: 'query:',
  },

  // Metrics cache
  metrics: {
    ttl: 30 * 60, // 30 minutes
    keyPrefix: 'metrics:',
  },
};

// Implement cache warming
async function warmCache() {
  const recentRuns = await getRecentRuns(24); // Last 24 hours
  for (const run of recentRuns) {
    await cacheContext(run.id);
  }
}
```

---

## Conclusion

This deployment guide provides complete infrastructure, CI/CD, and operational support for running the API Testing Platform in production environments.
