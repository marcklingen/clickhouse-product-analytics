FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS build

WORKDIR /app
COPY package.json package-lock.json* ./
COPY tsconfig.json tsconfig.base.json ./
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/react/package.json packages/react/package.json
COPY packages/ingest-service/package.json packages/ingest-service/package.json
COPY examples/nextjs-smoke/package.json examples/nextjs-smoke/package.json
RUN npm ci

COPY packages/sdk packages/sdk
COPY packages/react packages/react
COPY packages/ingest-service packages/ingest-service
RUN npm run build:packages
RUN npm prune --omit=dev

FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY LICENSE THIRD_PARTY_NOTICES.md ATTRIBUTION.md CONTAINER_THIRD_PARTY_NOTICES.md ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/sdk/package.json packages/sdk/package.json
COPY --from=build /app/packages/sdk/dist packages/sdk/dist
COPY --from=build /app/packages/ingest-service/package.json packages/ingest-service/package.json
COPY --from=build /app/packages/ingest-service/dist packages/ingest-service/dist
COPY --from=build /app/packages/ingest-service/migrations packages/ingest-service/migrations

WORKDIR /app/packages/ingest-service
USER node
CMD ["node", "dist/index.js"]
