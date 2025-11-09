# ---- build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# compile TS → ESM output (tsx can run at runtime too; compile is safer)
RUN npx tsc -p tsconfig.json

# ---- runtime stage
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# for Fastify to bind automatically on Render/Railway
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# copy migrations if your code reads from src/… adjust path if needed
COPY src/db/migrations ./dist/db/migrations
CMD ["node", "dist/index.js"]
