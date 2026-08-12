FROM node:22-alpine AS builder
WORKDIR /app

# Layer 1: Copy lockfiles & install dependencies (Cached if dependencies do not change)
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.npm npm install

# Layer 2: Copy source code & build production bundle
COPY . .
RUN npm run build

# Layer 3: Minimal Nginx runtime image
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
