# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=frontend-builder /app/client/dist ./public

EXPOSE 8080

CMD ["node", "index.js"]
