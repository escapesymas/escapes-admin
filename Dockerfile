FROM node:22-alpine AS builder
WORKDIR /app
COPY .env.build ./
RUN set -a && . ./.env.build && set +a
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ADMIN_KEY=${VITE_ADMIN_KEY}
ENV VITE_STRIPE_PUBLISHABLE_KEY=${VITE_STRIPE_PUBLISHABLE_KEY}
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
