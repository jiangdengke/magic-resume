# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# Keep this compatible with environments where BuildKit isn't enabled.
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm run build && pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache su-exec

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeapp

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Writable data dir for server-side persistence (resume + access key hash, etc.)
RUN mkdir -p /app/data && chown -R nodeapp:nodejs /app/data

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.mjs"]
