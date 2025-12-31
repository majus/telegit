# TeleGit Deployment Guide

This guide covers deploying TeleGit to production using Docker and Dokploy, as well as local development setup.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Docker Deployment](#docker-deployment)
- [Dokploy Deployment](#dokploy-deployment)
- [Environment Configuration](#environment-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)
- [Security Best Practices](#security-best-practices)

## Prerequisites

### Required Software

- **Node.js**: >= 22.0.0 (specified in `.nvm`)
- **MongoDB**: 8.x or higher
- **Docker**: 20.10 or higher
- **Docker Compose**: 2.x or higher (for local development)
- **Git**: For version control

### Required Accounts & Access

- **Telegram Bot**: Bot token from [@BotFather](https://t.me/BotFather)
- **OpenAI API**: API key for LLM functionality
- **GitHub**: Personal Access Token (PAT) for issue management
- **Container Registry**: GitHub Container Registry (GHCR) or Docker Hub
- **Dokploy** (optional): Account for managed deployments

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/majus/telegit.git
cd telegit
```

### 2. Install Dependencies

```bash
# Use Node.js 22 (recommended: use nvm)
nvm install 22
nvm use 22

# Install dependencies
npm install
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env with your credentials
nano .env
```

Required environment variables:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_IDS=123456789,-987654321

# Database Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=telegit

# Security
ENCRYPTION_KEY=<64-character-hex-string>

# LLM Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
```

### 4. Setup Database

```bash
# Start MongoDB (if using Docker)
docker run -d \
  --name telegit-mongodb \
  -e MONGO_INITDB_DATABASE=telegit \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongodb/mongodb-community-server:8.0-ubi8

# Initialize MongoDB schema
node db/mongodb-schema.js

# Verify connection
mongosh --eval "db.adminCommand('ping')"
```

### 5. Start Development Server

```bash
# Run tests
npm test

# Start application in development mode
npm run dev
```

## Docker Deployment

### Build Docker Image

```bash
# Build for local architecture
docker build -t telegit:latest .

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t telegit:latest \
  .
```

### Run with Docker Compose

```bash
# Start all services (app + database)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Manual Docker Run

```bash
# Start MongoDB
docker run -d \
  --name telegit-mongodb \
  --network telegit-net \
  -e MONGO_INITDB_DATABASE=telegit \
  -v mongodb_data:/data/db \
  mongodb/mongodb-community-server:8.0-ubi8

# Start TeleGit
docker run -d \
  --name telegit-app \
  --network telegit-net \
  -p 3000:3000 \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e TELEGRAM_CHAT_IDS=123456789 \
  -e MONGODB_URI=mongodb://telegit-mongodb:27017 \
  -e MONGODB_DATABASE=telegit \
  -e ENCRYPTION_KEY=your_64_char_hex_key \
  -e OPENAI_API_KEY=your_api_key \
  telegit:latest
```

## Dokploy Deployment

### Prerequisites

1. **Dokploy Account**: Sign up at [Dokploy](https://dokploy.com)
2. **Domain**: Configure DNS for your domain
3. **SSL Certificate**: Dokploy handles Let's Encrypt automatically

### Deploy via Dokploy CLI

```bash
# Deploy to staging
dokploy deploy --project telegit --env staging --config dokploy.yaml

# Deploy to production
dokploy deploy --project telegit --env production --config dokploy.yaml
```

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123456:ABC-DEF...` | ✓ |
| `TELEGRAM_CHAT_IDS` | Allowed chat IDs (comma-separated) | `123456789,-987654321` | ✓ |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017` | ✓ |
| `MONGODB_DATABASE` | MongoDB database name | `telegit` | ✓ |
| `ENCRYPTION_KEY` | 64-char hex encryption key | `0123456789abcdef...` | ✓ |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` | ✓ |
| `OPENAI_MODEL` | OpenAI model | `gpt-4` | ✓ |
| `NODE_ENV` | Environment | `production` | ✓ |
| `LOG_LEVEL` | Logging level | `info` | - |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_MCP_SERVER_URL` | GitHub MCP server URL | `http://localhost:3000/mcp` |
| `LLM_PROVIDER` | LLM provider | `openai` |
| `OPENAI_TEMPERATURE` | LLM temperature | `0.7` |
| `INTENT_CLASSIFIER_MODEL` | Intent classification model | `gpt-4` |
| `INTENT_CLASSIFIER_TEMPERATURE` | Intent classifier temperature | `0.3` |
| `INTENT_CONFIDENCE_THRESHOLD` | Intent confidence threshold | `0.3` |
| `GENERATOR_TEMPERATURE` | Generator temperature | `0.7` |
| `RATE_LIMIT_MAX_CONCURRENT` | Max concurrent operations | `5` |
| `RATE_LIMIT_MIN_TIME` | Min time between operations (ms) | `1000` |

### Generating Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
## Monitoring & Health Checks

### Health Check Endpoints

#### `/health` - Comprehensive Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "responseTime": 25,
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database is operational",
      "responseTime": 10
    },
    "llmApi": {
      "status": "healthy",
      "message": "LLM API configured",
      "responseTime": 5
    },
    "githubMcp": {
      "status": "healthy",
      "message": "GitHub MCP configured",
      "responseTime": 5
    },
    "telegramBot": {
      "status": "healthy",
      "message": "Telegram bot configured",
      "responseTime": 5
    }
  },
  "version": "1.0.0",
  "environment": "production"
}
```

#### `/health/liveness` - Kubernetes Liveness Probe

Simple check if the service is alive:

```bash
curl http://localhost:3000/health/liveness
```

#### `/health/readiness` - Kubernetes Readiness Probe

Check if the service is ready to accept traffic:

```bash
curl http://localhost:3000/health/readiness
```

#### `/metrics` - Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

### Docker Health Check

Built into the Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

### Monitoring Health Status

```bash
# Check Docker container health
docker ps --filter name=telegit

# View health check logs
docker inspect --format='{{json .State.Health}}' telegit-app | jq

# Monitor logs
docker logs -f telegit-app
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Fails

**Symptoms:**
- Application fails to start
- Health check shows database as critical
- Error: "Connection refused" or "Database not found"

**Solutions:**

```bash
# Check database is running
docker ps | grep mongodb

# Test connection manually
mongosh --host localhost --port 27017 --eval "db.adminCommand('ping')"

# Check database logs
docker logs telegit-mongodb

# Verify environment variables
docker exec telegit-app env | grep MONGODB
```

#### 2. Telegram Bot Not Responding

**Symptoms:**
- Bot doesn't respond to messages
- Webhook errors in logs

**Solutions:**

```bash
# Verify bot token
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# Check allowed chat IDs
docker exec telegit-app env | grep TELEGRAM_CHAT_IDS

# View application logs
docker logs telegit-app | grep -i telegram
```

#### 3. LLM API Errors

**Symptoms:**
- Messages not processed
- "LLM API error" in health check
- Rate limiting errors

**Solutions:**

```bash
# Verify API key
docker exec telegit-app env | grep OPENAI_API_KEY

# Check API status
curl https://status.openai.com/api/v2/status.json

# Review rate limiting configuration
docker exec telegit-app env | grep RATE_LIMIT
```

#### 4. Health Check Fails

**Symptoms:**
- Container marked as unhealthy
- Deployment fails

**Solutions:**

```bash
# Check health endpoint manually
curl -v http://localhost:3000/health

# Increase health check timeout
docker run ... --health-timeout=20s ...

# Review application logs
docker logs telegit-app --tail 100
```

#### 5. Container Fails to Start

**Symptoms:**
- Container exits immediately
- "Error: Cannot find module" errors

**Solutions:**

```bash
# Check for missing dependencies
docker run --rm telegit:latest npm list

# Verify file permissions
docker exec telegit-app ls -la /app

# Review startup logs
docker logs telegit-app

# Run interactive shell for debugging
docker run -it --entrypoint sh telegit:latest
```

### Debug Mode

Enable debug logging:

```bash
# Set LOG_LEVEL to debug
docker run -e LOG_LEVEL=debug ...

# Or in .env
LOG_LEVEL=debug
```

### Getting Help

1. **Check logs**: Always start with application and database logs
2. **Review environment**: Verify all required environment variables are set
3. **Test components**: Test database, Telegram API, and LLM API independently
4. **GitHub Issues**: Report issues at https://github.com/majus/telegit/issues

## Security Best Practices

### 1. Environment Variables

- **Never commit** `.env` files to version control
- Use **secrets management** (GitHub Secrets, Dokploy Secrets)
- Rotate credentials regularly (quarterly minimum)
- Use **strong passwords** for database (min 16 characters)
- Generate secure encryption keys (32 bytes / 64 hex characters)

### 2. Container Security

- Run as **non-root user** (configured in Dockerfile)
- Keep base images **up to date** (Node.js 22-alpine)
- Scan images for vulnerabilities (Trivy in CI/CD)
- Minimize attack surface (multi-stage builds)
- Use **read-only volumes** where possible

### 3. Network Security

- Enable **SSL/TLS** for all external communications
- Use **firewall rules** to restrict access
- Enable **HTTPS only** (configured in Dokploy)
- Use **private networks** for database connections
- Implement **rate limiting** (configured in application)

### 4. Database Security

- Use **encrypted connections** (SSL/TLS)
- Restrict database **user permissions** (principle of least privilege)
- Enable **automatic backups** (daily minimum)
- Store backups in **encrypted storage**
- Test backup restoration regularly

### 5. Application Security

- Encrypt sensitive data at rest (GitHub PATs)
- Validate all user inputs
- Implement proper error handling (no sensitive info in logs)
- Keep dependencies updated (npm audit)
- Enable security headers
- Implement proper authentication/authorization

### 6. Monitoring & Logging

- **Enable monitoring** (health checks, metrics)
- **Centralized logging** (avoid logging sensitive data)
- Set up **alerts** for critical errors
- Monitor for **security events**
- Regular security audits

### 7. Access Control

- Use **principle of least privilege**
- Enable **2FA** for all accounts
- Regularly review access logs
- Revoke unused credentials
- Use **SSH keys** instead of passwords

### Security Checklist for Deployment

- [ ] All secrets stored in secure secrets manager
- [ ] Strong, unique passwords generated
- [ ] Encryption key generated securely
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Database backups enabled
- [ ] Monitoring and alerts configured
- [ ] Security scanning enabled in CI/CD
- [ ] Dependencies updated and audited
- [ ] Access controls reviewed
- [ ] Incident response plan documented

## Additional Resources

- [TeleGit README](./README.md) - Project overview and features
- [Contributing Guide](./CONTRIBUTING.md) - Development guidelines
- [Dokploy Documentation](https://docs.dokploy.com)
- [Docker Documentation](https://docs.docker.com)
- [MongoDB Documentation](https://www.mongodb.com/docs/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## Support

For deployment issues:

1. Check this guide and [README.md](./README.md)
2. Review [GitHub Issues](https://github.com/majus/telegit/issues)
3. Create a new issue with:
   - Deployment method (Docker/Dokploy)
   - Error messages and logs
   - Environment details
   - Steps to reproduce
