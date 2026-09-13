FROM node:22-alpine AS web-vendor

WORKDIR /vendor
COPY docker/web/package.json docker/web/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-vendor /vendor/node_modules/marked/lib/marked.esm.js /usr/share/nginx/html/_vendor/marked/marked.esm.js
COPY --from=web-vendor /vendor/node_modules/mermaid/dist/mermaid.esm.min.mjs /usr/share/nginx/html/_vendor/mermaid/mermaid.esm.min.mjs
COPY --from=web-vendor /vendor/node_modules/mermaid/dist/chunks/mermaid.esm.min/ /usr/share/nginx/html/_vendor/mermaid/chunks/mermaid.esm.min/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
