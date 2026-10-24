FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3.14-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/.output ./.output
COPY drizzle ./drizzle
COPY scripts/migrate.mjs scripts/start.mjs ./scripts/
EXPOSE 3000
CMD ["bun", "scripts/start.mjs"]
