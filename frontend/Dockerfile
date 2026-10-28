FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY nginx/http.conf /etc/nginx/conf.d/default.conf
COPY nginx/locations.conf /etc/nginx/snippets/masso-locations.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
