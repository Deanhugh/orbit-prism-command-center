# Orbit Prism Operating System — persistent Node server (for Railway or any container host)
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node scripts/decode-b64-assets.mjs
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/brain ./brain
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/office.config.json ./office.config.json

RUN mkdir -p /app/data /app/brain

EXPOSE 43140
# Railway provides $PORT; fall back to 43140 locally.
# Do not force ORBIT_MODE=demo — set that in Railway only if you want simulated work.
CMD ["sh", "-c", "npx next start -p ${PORT:-43140}]"]