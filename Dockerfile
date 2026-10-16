# ---- base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
# Use npm ci when lockfile exists, fallback to npm install
RUN npm ci || npm install
COPY . .

# ---- development (local dev inside docker, optional) ----
FROM base AS development
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- build ----
FROM base AS build
# Prisma client generation only when schema exists (forward-compatible with Milestone 1)
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate; fi
RUN npm run build
# Remove dev deps for smaller production copy (reinstalled in production stage)
RUN npm prune --omit=dev || true

# ---- production ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY --from=build /app/dist ./dist
# Prisma schema + migrations so `migrate deploy` works at runtime
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
# Run migrations when Prisma is present, then start API.
# `|| true` keeps the container working before Prisma is added.
CMD ["sh", "-c", "if [ -f ./node_modules/.bin/prisma ]; then ./node_modules/.bin/prisma migrate deploy || true; fi && node dist/main"]
