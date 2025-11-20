# Multi-stage Dockerfile for TeleGit
# Stage 1: Build dependencies
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Run tests (optional - can be skipped in CI if tests run separately)
# RUN npm test

# Stage 2: Production runtime
FROM node:22-alpine AS runtime

# Install production dependencies only
RUN apk add --no-cache \
    dumb-init \
    postgresql-client

# Create non-root user for security
RUN addgroup -g 1001 -S telegit && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G telegit -g telegit telegit

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy application code from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/db ./db
COPY --from=builder /app/config ./config
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/.nvm ./.nvm

# Change ownership to non-root user
RUN chown -R telegit:telegit /app

# Switch to non-root user
USER telegit

# Expose health check port (if using HTTP server)
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
