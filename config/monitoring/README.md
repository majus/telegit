# TeleGit Monitoring & Observability

This directory contains configuration files for monitoring and observability infrastructure for TeleGit.

## Overview

The monitoring system consists of:

1. **Pino Logger** - Structured JSON logging with sensitive data redaction
2. **Prometheus Metrics** - Time-series metrics collection
3. **Health Checks** - Service health monitoring endpoints
4. **Alerting Rules** - Automated alerts for critical issues

## Components

### Logging (`src/utils/logger.js`)

Structured JSON logging using Pino with:

- Log levels: trace, debug, info, warn, error, fatal
- Automatic redaction of sensitive fields (tokens, passwords, etc.)
- Timestamps in ISO format
- Service and environment metadata

**Usage:**

```javascript
import logger, { info, warn, error } from './utils/logger.js';

// Simple logging
info('Message processed successfully');

// Logging with context
info({ messageId: '123', chatId: 456 }, 'Processing message');

// Error logging
error({ err, context }, 'Failed to process message');

// Child logger with persistent context
const childLogger = logger.child({ service: 'github-integration' });
childLogger.info('GitHub API call started');
```

**Environment Variables:**

- `LOG_LEVEL` - Log level (default: `info`)
- `NODE_ENV` - Environment name (default: `development`)

### Metrics (`src/utils/metrics.js`)

Prometheus metrics collection with:

**Counters:**
- `telegit_messages_processed_total` - Total messages processed
- `telegit_github_api_calls_total` - Total GitHub API calls
- `telegit_llm_api_calls_total` - Total LLM API calls
- `telegit_llm_tokens_used_total` - Total LLM tokens used
- `telegit_database_queries_total` - Total database queries
- `telegit_errors_total` - Total errors by type

**Histograms:**
- `telegit_processing_duration_seconds` - Message processing time
- `telegit_github_api_duration_seconds` - GitHub API request time
- `telegit_llm_api_duration_seconds` - LLM API request time
- `telegit_database_query_duration_seconds` - Database query time

**Gauges:**
- `telegit_active_operations` - Currently active operations
- `telegit_queue_backlog` - Messages waiting in queue
- `telegit_database_connection_pool` - Database connection pool status

**Usage:**

```javascript
import {
  trackMessageProcessing,
  trackGitHubApiCall,
  trackLLMApiCall,
  trackDatabaseQuery,
} from './utils/metrics.js';

// Track message processing
await trackMessageProcessing(async () => {
  // Your processing logic
  return result;
}, 'create_issue');

// Track GitHub API call
await trackGitHubApiCall(async () => {
  // Your API call
  return response;
}, 'create_issue');

// Track LLM API call with token usage
await trackLLMApiCall(
  async () => {
    // Your LLM call
    return response;
  },
  'gpt-4',
  { promptTokens: 100, completionTokens: 50 }
);

// Track database query
await trackDatabaseQuery(async () => {
  // Your query
  return result;
}, 'insert_operation');
```

### Health Checks (`src/api/health.js`)

Multiple health check endpoints:

**Endpoints:**

1. **`GET /api/health`** - Comprehensive health check
   - Returns: Detailed status of all dependencies
   - Status codes: 200 (healthy/degraded), 503 (critical)
   - Checks: Database, LLM API, GitHub MCP, Telegram Bot

2. **`GET /api/metrics`** - Prometheus metrics
   - Returns: Metrics in Prometheus exposition format
   - Content-Type: text/plain; version=0.0.4

3. **`GET /api/ready`** - Readiness probe (Kubernetes-style)
   - Returns: { ready: boolean, status: string }
   - Status codes: 200 (ready), 503 (not ready)

4. **`GET /api/live`** - Liveness probe (Kubernetes-style)
   - Returns: { alive: boolean, uptime: number }
   - Status codes: 200 (alive), 500 (not alive)

**Health Status Levels:**

- `healthy` - All systems operational
- `degraded` - Service operational but with issues
- `critical` - Service unavailable or critical failures

**Example Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-19T12:00:00.000Z",
  "uptime": 3600,
  "responseTime": 45,
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database is operational",
      "responseTime": 12
    },
    "llmApi": {
      "status": "healthy",
      "message": "LLM API configured",
      "responseTime": 5
    },
    "githubMcp": {
      "status": "healthy",
      "message": "GitHub MCP configured",
      "responseTime": 3
    },
    "telegramBot": {
      "status": "healthy",
      "message": "Telegram bot configured",
      "responseTime": 2
    }
  },
  "version": "1.0.0",
  "environment": "production"
}
```

## Configuration Files

### `prometheus.yml`

Prometheus scraping configuration:

- Scrapes TeleGit metrics every 15 seconds
- Evaluates alerting rules every 15 seconds
- Retains data for 15 days
- Maximum storage size: 10GB

**Scrape Targets:**
- `telegit` - Main application (port 3000)
- `prometheus` - Prometheus self-monitoring (port 9090)
- `node` - Node exporter (port 9100)
- `postgres` - PostgreSQL exporter (port 9187)

### `alerts.yml`

Alerting rules for common issues:

**Critical Alerts:**
- High error rate (>10% for 5 minutes)
- Critical queue backlog (>500 messages)
- Database connection errors
- Service down

**Warning Alerts:**
- Queue backlog (>100 messages)
- Slow message processing (p95 >30s)
- High GitHub API error rate (>20%)
- High LLM API error rate (>20%)
- High memory usage (>1GB)
- High CPU usage (>80%)
- High token usage (>1M tokens/hour)
- Slow database queries (p95 >2s)

### `alertmanager.yml`

Alert routing and notification configuration:

**Routes:**
- Critical alerts → immediate notification (1h repeat)
- Warning alerts → standard notification (4h repeat)
- Database alerts → database team
- Cost alerts → billing team

**Receivers:**
- `default-receiver` - Default webhook
- `critical-receiver` - High-priority channels
- `warning-receiver` - Standard channels
- `database-team-receiver` - Database team notifications
- `cost-monitoring-receiver` - Cost alerts

**Inhibition Rules:**
- Suppress queue backlog warnings when critical backlog is active
- Suppress performance alerts when service is down

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  telegit:
    build: .
    ports:
      - "3000:3000"
    environment:
      - LOG_LEVEL=info
      - NODE_ENV=production
    depends_on:
      - postgres
      - prometheus

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./config/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./config/monitoring/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./config/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  alertmanager-data:
  grafana-data:
```

### Kubernetes

**Health Check Configuration:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: telegit
spec:
  containers:
    - name: telegit
      image: telegit:latest
      ports:
        - containerPort: 3000
      livenessProbe:
        httpGet:
          path: /api/live
          port: 3000
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /api/ready
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 3
```

## Grafana Dashboards

### Metrics to Monitor

1. **Service Health**
   - Error rate
   - Request throughput
   - Response time (p50, p95, p99)
   - Active operations

2. **Queue Status**
   - Queue backlog
   - Processing rate
   - Queue wait time

3. **External APIs**
   - GitHub API: calls, errors, duration
   - LLM API: calls, errors, duration, tokens

4. **Database**
   - Query count
   - Query duration
   - Connection pool status
   - Error rate

5. **Resources**
   - CPU usage
   - Memory usage
   - Process uptime

## Best Practices

1. **Logging**
   - Use structured logging with context
   - Never log sensitive data (tokens, passwords)
   - Use appropriate log levels
   - Include correlation IDs for tracing

2. **Metrics**
   - Use meaningful label values
   - Avoid high-cardinality labels
   - Track both success and failure cases
   - Include duration metrics for performance monitoring

3. **Alerts**
   - Set appropriate thresholds
   - Include runbook links in annotations
   - Use inhibition rules to prevent alert spam
   - Test alerts regularly

4. **Health Checks**
   - Keep checks lightweight
   - Check all critical dependencies
   - Return appropriate status codes
   - Include useful diagnostic information

## Troubleshooting

### High Error Rate

1. Check `/api/health` for dependency status
2. Review error logs with `LOG_LEVEL=debug`
3. Check external API status (GitHub, LLM provider)
4. Review recent code changes

### Queue Backlog

1. Check processing performance metrics
2. Review LLM API response times
3. Scale up workers if needed
4. Check for stuck operations

### Slow Processing

1. Check LLM API latency
2. Review database query performance
3. Check GitHub API rate limits
4. Profile application code

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Pino Logger Documentation](https://getpino.io/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
