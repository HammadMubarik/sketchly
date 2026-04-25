# Builds the Vite frontend and the Express/yjs backend, then serves both
# from a single Node process on Railway's $PORT.

# ---- Frontend build ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Vite inlines these at build time, so they must be present here, not at runtime.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Backend build ----
FROM node:20-alpine AS backend-builder
WORKDIR /app
RUN corepack enable

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN pnpm run build

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist ./public

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
