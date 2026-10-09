# syntax=docker/dockerfile:1

FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_DEMO_MODE=off
# Build with explicitly provided backend URL and demo mode or fall back to values in .env/.env.production
RUN NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL:-}" \
    NEXT_PUBLIC_DEMO_MODE="${NEXT_PUBLIC_DEMO_MODE:-off}" \
    npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
