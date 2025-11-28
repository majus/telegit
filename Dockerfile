# Production Dockerfile for TeleGit
FROM node:22-alpine

# Install runtime dependencies
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

# Copy application code
COPY src ./src
COPY db ./db
COPY config ./config
COPY prompts ./prompts
COPY .nvmrc ./

# Change ownership to non-root user
RUN chown -R telegit:telegit /app

# Switch to non-root user
USER telegit

# Expose health check port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
