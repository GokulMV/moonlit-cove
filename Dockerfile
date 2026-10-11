# Moonlit Cove: build the page, then serve it with a tiny Node server.

# 1. build: fonts and three.js come from npm; the page goes to public/
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src3d ./src3d
COPY assets ./assets
COPY tools/build3d.mjs ./tools/build3d.mjs
RUN npm run build

# 2. serve: just the server and what the build made (no node_modules needed)
FROM node:22-alpine
WORKDIR /app
# the wish board keeps its wishes in DATA_DIR: mount a volume there (on Railway, a volume at /data)
ENV NODE_ENV=production DATA_DIR=/data
# su-exec lets the entrypoint hand the volume to the node user, then run the server as that user
RUN apk add --no-cache su-exec && mkdir -p /data && chown node:node /data
COPY package.json server.js docker-entrypoint.sh ./
COPY --from=build /app/public ./public
RUN chmod +x docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
