# Multi-stage Dockerfile for TeleGit production deployment
# Base image: Node.js 22 Alpine for minimal footprint

# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Production image
FROM node:22-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S telegit -u 1001

# Copy dependencies from deps stage
COPY --from=deps --chown=telegit:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=telegit:nodejs package*.json ./
COPY --chown=telegit:nodejs src ./src
COPY --chown=telegit:nodejs db ./db
COPY --chown=telegit:nodejs config ./config
COPY --chown=telegit:nodejs prompts ./prompts

# Switch to non-root user
USER telegit

# Expose port (if needed for future API endpoints)
EXPOSE 3000

# Environment variables (set via deployment config)
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
