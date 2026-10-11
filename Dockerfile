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
ENV NODE_ENV=production
COPY package.json server.js ./
COPY --from=build /app/public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
