FROM node:22-alpine AS builder
WORKDIR /app
# Vite needs these at build time, not runtime
ARG VITE_API_URL=https://api.escapesymas.com
ARG VITE_ADMIN_KEY=escapes-admin-sync-key-2026-change-me
ARG VITE_STRIPE_PUBLISHABLE_KEY=pk_live_placeholder
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_KEY=$VITE_ADMIN_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
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
