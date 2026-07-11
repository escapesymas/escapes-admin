FROM node:22-alpine AS builder
WORKDIR /app
COPY ADMIN/package.json ADMIN/pnpm-lock.yaml ./
RUN npm install
COPY ADMIN/. .
RUN npm run build

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ADMIN/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
