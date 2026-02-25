FROM node:20-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/config ./config
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p public/uploads

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
