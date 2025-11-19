# TeleGit Deployment Guide

This guide covers deploying TeleGit to production using Docker, Dokploy, and GitHub Actions CI/CD.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
- [Dokploy Deployment](#dokploy-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- Docker 20.10+ and Docker Compose 2.0+
- Node.js 22+ (for local development)
- PostgreSQL 16+ (or use Docker)
- Git

### Required Services

- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- OpenAI API Key (for LLM processing)
- GitHub Personal Access Token (for GitHub API access)
- Dokploy instance (for production deployment)

## Local Development Setup

### Using Docker Compose

1. **Clone the repository:**

```bash
git clone https://github.com/majus/telegit.git
cd telegit
```

2. **Create environment file:**

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=telegit
DB_USER=telegit
DB_PASSWORD=telegit_dev_password

# Node Environment
NODE_ENV=development

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_64_char_hex_encryption_key_here

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# GitHub MCP Server
GITHUB_MCP_SERVER_PATH=/path/to/github-mcp-server
```

3. **Start services:**

```bash
docker-compose up -d
```

4. **View logs:**

```bash
docker-compose logs -f app
```

5. **Stop services:**

```bash
docker-compose down
```

### Native Development (without Docker)

1. **Install dependencies:**

```bash
npm install
```

2. **Setup PostgreSQL database:**

```bash
# Create database
createdb telegit

# Run schema migration
psql -d telegit -f db/schema.sql
```

3. **Configure environment:**

Create `.env` file as shown above, but use `localhost` for `DB_HOST`.

4. **Start development server:**

```bash
npm run dev
```

## Production Deployment

### Building Docker Image

1. **Build production image:**

```bash
docker build -t telegit:latest .
```

2. **Run production container:**

```bash
docker run -d \
  --name telegit \
  -e NODE_ENV=production \
  -e DB_HOST=your_db_host \
  -e DB_PORT=5432 \
  -e DB_NAME=telegit \
  -e DB_USER=telegit \
  -e DB_PASSWORD=your_db_password \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e ENCRYPTION_KEY=your_key \
  -e OPENAI_API_KEY=your_api_key \
  -e GITHUB_MCP_SERVER_PATH=/path/to/mcp \
  telegit:latest
```

### Using GitHub Container Registry

Images are automatically built and pushed to GitHub Container Registry (GHCR) on version tags.

1. **Pull image:**

```bash
docker pull ghcr.io/majus/telegit:latest
```

2. **Run container:**

```bash
docker run -d \
  --name telegit \
  --env-file .env.production \
  ghcr.io/majus/telegit:latest
```

## Dokploy Deployment

Dokploy simplifies deployment with built-in SSL, auto-scaling, and monitoring.

### Initial Setup

1. **Install Dokploy** on your server following the [official documentation](https://docs.dokploy.com/).

2. **Create a new application** in Dokploy dashboard:
   - Name: `telegit`
   - Type: `Docker`
   - Repository: `https://github.com/majus/telegit.git`

3. **Configure environment variables** in Dokploy dashboard (see [Environment Variables](#environment-variables))

4. **Import configuration:**

Upload `dokploy.json` to auto-configure the application, or manually set:
- Dockerfile path: `Dockerfile`
- Port: `3000`
- Replicas: `1`
- Auto-deploy: `enabled`

### Database Setup in Dokploy

1. **Create PostgreSQL service:**
   - Image: `postgres:16-alpine`
   - Volume: `/var/lib/postgresql/data`
   - Environment variables:
     - `POSTGRES_DB=telegit`
     - `POSTGRES_USER=telegit`
     - `POSTGRES_PASSWORD=<secure_password>`

2. **Initialize schema:**

```bash
# Connect to Dokploy PostgreSQL service
docker exec -i <postgres_container_id> psql -U telegit -d telegit < db/schema.sql
```

### Domain Configuration

1. **Add custom domain** in Dokploy:
   - Domain: `telegit.example.com`
   - HTTPS: Enabled (Let's Encrypt)
   - Path: `/`

2. **DNS Configuration:**

Add A record pointing to your Dokploy server IP:

```
A    telegit.example.com    ->    YOUR_SERVER_IP
```

### Scaling Configuration

Dokploy auto-scaling is configured in `dokploy.json`:

- Minimum replicas: `1`
- Maximum replicas: `3`
- CPU threshold: `70%`
- Memory threshold: `80%`

## CI/CD Pipeline

TeleGit uses GitHub Actions for automated testing, building, and deployment.

### Workflows

#### 1. Test Workflow (`.github/workflows/test.yml`)

**Triggers:**
- Push to `main`, `develop`, `feature/**`, `claude/**`
- Pull requests to `main`, `develop`

**Steps:**
- Checkout code
- Setup Node.js 22
- Install dependencies
- Initialize test database
- Run tests with coverage
- Upload coverage to Codecov

#### 2. Build Workflow (`.github/workflows/build.yml`)

**Triggers:**
- Push tags matching `v*.*.*` (e.g., `v1.0.0`)
- Manual workflow dispatch

**Steps:**
- Checkout code
- Setup Docker Buildx
- Login to GitHub Container Registry
- Build multi-platform images (linux/amd64, linux/arm64)
- Push to GHCR with semantic version tags

**Generated tags:**
- `ghcr.io/majus/telegit:1.0.0`
- `ghcr.io/majus/telegit:1.0`
- `ghcr.io/majus/telegit:1`
- `ghcr.io/majus/telegit:latest`

#### 3. Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Manual workflow dispatch with environment selection

**Environments:**
- **Staging:** Auto-deploy without approval
- **Production:** Requires manual approval

**Steps:**
- Checkout code
- Deploy to selected environment via Dokploy API
- Verify deployment
- Generate deployment summary

### Setting Up GitHub Secrets

Configure these secrets in GitHub repository settings:

```
# Test encryption key (64 hex characters)
TEST_ENCRYPTION_KEY=<generated_key>

# Codecov token
CODECOV_TOKEN=<your_codecov_token>

# Dokploy staging
DOKPLOY_STAGING_API_URL=<dokploy_staging_api_url>
DOKPLOY_STAGING_API_TOKEN=<dokploy_staging_token>

# Dokploy production
DOKPLOY_PRODUCTION_API_URL=<dokploy_production_api_url>
DOKPLOY_PRODUCTION_API_TOKEN=<dokploy_production_token>
```

### Creating a Release

1. **Tag a new version:**

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

2. **Monitor build workflow** in GitHub Actions

3. **Deploy to staging:**

```bash
# Via GitHub Actions UI
# 1. Go to Actions > Deploy workflow
# 2. Click "Run workflow"
# 3. Select "staging" environment
# 4. Enter image tag (e.g., "v1.0.0")
# 5. Click "Run workflow"
```

4. **Deploy to production** (requires approval):

```bash
# Via GitHub Actions UI
# 1. Go to Actions > Deploy workflow
# 2. Click "Run workflow"
# 3. Select "production" environment
# 4. Enter image tag (e.g., "v1.0.0")
# 5. Click "Run workflow"
# 6. Wait for approval notification
# 7. Approve deployment in GitHub UI
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `DB_HOST` | PostgreSQL host | `postgres` or `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `telegit` |
| `DB_USER` | Database user | `telegit` |
| `DB_PASSWORD` | Database password | `<secure_password>` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM | Generate with command below |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `GITHUB_MCP_SERVER_PATH` | Path to GitHub MCP server | `/usr/local/bin/github-mcp-server` |

### Generating Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `MAX_CONNECTIONS` | Database pool size | `10` |

## Database Setup

### Initial Migration

```bash
# Using psql
psql -h your_db_host -U telegit -d telegit -f db/schema.sql

# Using Docker
docker exec -i postgres_container psql -U telegit -d telegit < db/schema.sql
```

### Backup and Restore

**Backup:**

```bash
# Full database backup
pg_dump -h your_db_host -U telegit -d telegit -F c -f telegit_backup.dump

# Schema only
pg_dump -h your_db_host -U telegit -d telegit --schema-only > schema_backup.sql
```

**Restore:**

```bash
# Restore full backup
pg_restore -h your_db_host -U telegit -d telegit telegit_backup.dump

# Restore schema
psql -h your_db_host -U telegit -d telegit < schema_backup.sql
```

## Monitoring and Maintenance

### Logs

**Docker Compose:**

```bash
docker-compose logs -f app
```

**Dokploy:**

Access logs via Dokploy dashboard under Application > Logs.

**Production container:**

```bash
docker logs -f telegit
```

### Health Checks

Monitor application health by checking:

1. **Container status:**

```bash
docker ps | grep telegit
```

2. **Database connectivity:**

```bash
docker exec telegit node -e "const { Pool } = require('pg'); const pool = new Pool(); pool.query('SELECT 1').then(() => console.log('OK')).catch(console.error)"
```

3. **Application logs** for errors

### Database Maintenance

**Vacuum and analyze:**

```bash
docker exec postgres_container psql -U telegit -d telegit -c "VACUUM ANALYZE;"
```

**Check database size:**

```bash
docker exec postgres_container psql -U telegit -d telegit -c "SELECT pg_size_pretty(pg_database_size('telegit'));"
```

### Cleanup

**Remove old feedback messages:**

Feedback messages are auto-deleted after 10 minutes by the bot. To manually clean up:

```sql
DELETE FROM operation_feedback
WHERE scheduled_deletion < NOW() AND dismissed = FALSE;
```

**Clean expired context cache:**

```sql
DELETE FROM conversation_context
WHERE expires_at < NOW();
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

**Symptoms:** Application fails to start with database connection error.

**Solutions:**
- Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` are correct
- Check PostgreSQL is running: `docker ps | grep postgres`
- Test connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`
- Check network connectivity between containers

#### 2. Telegram Bot Not Responding

**Symptoms:** Bot doesn't respond to messages.

**Solutions:**
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check bot logs for errors: `docker logs telegit`
- Test token with Telegram API:
  ```bash
  curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
  ```
- Ensure bot is started in the code

#### 3. GitHub Integration Failed

**Symptoms:** Cannot create GitHub issues.

**Solutions:**
- Verify GitHub PAT is valid and not expired
- Check PAT has required permissions: `repo`, `issues`
- Verify `GITHUB_MCP_SERVER_PATH` is correct
- Check GitHub MCP server is accessible

#### 4. Encryption Errors

**Symptoms:** "Invalid encryption key" or decryption errors.

**Solutions:**
- Verify `ENCRYPTION_KEY` is 64 hexadecimal characters (32 bytes)
- Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Don't change key after encrypting data (will break existing encrypted tokens)

#### 5. Docker Build Fails

**Symptoms:** Docker build fails with errors.

**Solutions:**
- Ensure Node.js 22+ compatibility
- Check Dockerfile syntax
- Verify `.dockerignore` doesn't exclude required files
- Clear Docker cache: `docker builder prune -a`

#### 6. CI/CD Pipeline Failures

**Symptoms:** GitHub Actions workflows fail.

**Solutions:**
- Check GitHub secrets are configured correctly
- Verify workflow permissions (read/write for packages)
- Review workflow logs for specific errors
- Ensure branch protection rules don't block automated pushes

### Getting Help

If you encounter issues not covered here:

1. Check application logs for detailed error messages
2. Review GitHub Issues: https://github.com/majus/telegit/issues
3. Create a new issue with:
   - Error message and stack trace
   - Environment details (Docker version, Node.js version)
   - Steps to reproduce
   - Relevant logs

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use strong encryption keys** (64 hex characters minimum)
3. **Rotate credentials regularly** (GitHub PAT, database passwords)
4. **Enable GitHub branch protection** for main/production branches
5. **Use environment-specific secrets** in Dokploy
6. **Monitor logs** for suspicious activity
7. **Keep dependencies updated** (`npm audit fix`)
8. **Use HTTPS** for all external communications
9. **Implement rate limiting** for bot commands (TODO)
10. **Regular database backups** (automated daily recommended)

## Performance Optimization

1. **Database connection pooling** configured via `MAX_CONNECTIONS`
2. **Docker multi-stage builds** minimize image size
3. **Alpine Linux base** for minimal footprint
4. **Caching** enabled in Docker Buildx
5. **Auto-scaling** configured in Dokploy (CPU/memory thresholds)
6. **Conversation context TTL** reduces database bloat
7. **Feedback message auto-deletion** after 10 minutes

## Upgrade Guide

When upgrading to a new version:

1. **Review CHANGELOG** for breaking changes
2. **Backup database** before upgrade
3. **Run database migrations** if schema changed
4. **Test in staging** before production
5. **Monitor logs** after deployment
6. **Rollback if needed** using previous Docker tag

```bash
# Rollback example
docker pull ghcr.io/majus/telegit:v1.0.0
docker-compose down
docker-compose up -d
```

## Additional Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Dokploy Documentation](https://docs.dokploy.com/)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
