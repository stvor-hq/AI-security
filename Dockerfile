FROM oven/bun:1.2.6-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2.6-alpine
WORKDIR /app
ENV PORT=8787
# STVOR_APP_TOKEN must be passed at runtime via environment variables.
# Do NOT hardcode secrets in the image.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src
RUN mkdir -p /app/data && chown -R bun:bun /app
EXPOSE 8787
USER bun
CMD ["bun", "src/relay/server.ts"]
