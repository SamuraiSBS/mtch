FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BETTER_AUTH_SECRET=build-only-placeholder-not-for-runtime-123456 DATABASE_URL=postgres://mtch:unused@db:5432/mtch BETTER_AUTH_URL=http://localhost:3000
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
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
