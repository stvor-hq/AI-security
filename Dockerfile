### Multi-stage Dockerfile for Stvor Cloud demo (Bun)
### Builder: install deps and prepare app
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# Copy lockfile and package manifest first to leverage caching
COPY package.json bun.lockb* ./

# Install production dependencies (falls back to full install if --production not supported)
RUN bun install --production || bun install

# Copy source files after deps install so source changes do not invalidate dependency cache
COPY . .

# Run build-time smoke test to catch dockerization issues early
RUN bun test --timeout 30000

### Final runtime image: minimal Bun alpine
FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app

# Copy artifacts from builder
COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 8080

# Default command runs the cinematic demo; override to run the API server
CMD ["bun", "start:demo"]
