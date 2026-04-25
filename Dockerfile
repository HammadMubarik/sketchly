# Builds and runs the Sketchly backend (Express API + yjs WebSocket on one port).
# The frontend is a Vite static site and is intended to be deployed elsewhere.

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN pnpm run build


FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
