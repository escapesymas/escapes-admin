FROM node:22-alpine AS builder
WORKDIR /app
# Load Vite env vars from .env.build at build time
COPY .env.build ./
RUN set -a && . ./.env.build && set +a
COPY package.json pnpm-lock.yaml ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
