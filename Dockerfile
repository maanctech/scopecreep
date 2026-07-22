FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY app ./app
COPY components ./components
COPY lib ./lib
COPY next-env.d.ts next.config.mjs postcss.config.js proxy.ts tailwind.config.ts tsconfig.json ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_CACHE=/tmp/.npm \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl postgresql-client-15 tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 scopeledger \
    && useradd --system --uid 1001 --gid scopeledger --home-dir /app scopeledger

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build --chown=scopeledger:scopeledger /app/.next ./.next
COPY --chown=scopeledger:scopeledger db ./db
COPY --chown=scopeledger:scopeledger lib ./lib
COPY --chown=scopeledger:scopeledger scripts ./scripts
COPY --chown=scopeledger:scopeledger next.config.mjs tsconfig.json ./

RUN mkdir -p /app/data/documents /app/data/import-backups /app/backups \
    && chown -R scopeledger:scopeledger /app/data /app/backups \
    && chmod 0755 /app/scripts/docker-entrypoint.sh

USER scopeledger

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=4 \
  CMD curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/app/scripts/docker-entrypoint.sh"]
CMD ["npm", "start"]
