ARG NODE_BASE=node:24-bookworm-slim
FROM ${NODE_BASE} AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BETTER_AUTH_SECRET=build-only-placeholder-not-for-runtime-123456 DATABASE_URL=postgres://mtch:unused@db:5432/mtch BETTER_AUTH_URL=http://localhost:3000
RUN npm run build

FROM ${NODE_BASE}
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
COPY photo-processor/requirements.txt ./photo-processor/requirements.txt
RUN python3 -m venv /opt/photo-venv && /opt/photo-venv/bin/pip install --no-cache-dir -r photo-processor/requirements.txt
COPY photo-processor/processor.py photo-processor/download_models.py ./photo-processor/
COPY photo-processor/models ./photo-processor/models
RUN /opt/photo-venv/bin/python photo-processor/download_models.py --verify-only
COPY photo-processor/fixtures ./photo-processor/fixtures
ENV PHOTO_PYTHON=/opt/photo-venv/bin/python
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./package.json
EXPOSE 3000
CMD ["node", "server.js"]
