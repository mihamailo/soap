FROM node:24-slim AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:24-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=12 CMD node -e "const port = process.env.PORT || process.env.APP_PORT || 3000; require('node:http').get(`http://127.0.0.1:${port}/health`, (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server/frontend.js"]
