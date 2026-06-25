# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Build-time API base (passed from docker-compose). The frontend calls this path;
# the outer server proxy routes /api to the backend.
ARG VITE_API_BASE_URL=/api/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# --- serve stage (no nginx) ---
FROM node:20-alpine
WORKDIR /app

# Lightweight static file server with SPA fallback.
RUN npm install -g serve
COPY --from=build /app/dist ./dist

EXPOSE 7303
# -s = single-page-app mode (rewrite unknown routes to index.html)
CMD ["serve", "-s", "dist", "-l", "7303"]
