FROM node:26-alpine3.24 AS astro_builder
WORKDIR /app

ARG SITE_URL=https://example.com
ENV SITE_URL=$SITE_URL

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PNPM_STORE_DIR="/pnpm/store"

RUN npm install --global pnpm@12.3.4

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .
RUN --mount=type=cache,target=/pnpm/store pnpm build

FROM golang:1.27-alpine AS go_builder
RUN apk add --no-cache ca-certificates
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY go.mod server.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server .

FROM scratch

COPY --from=go_builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=go_builder /etc/passwd /etc/passwd
COPY --from=go_builder /etc/group /etc/group

USER appuser
WORKDIR /app

COPY --from=astro_builder /app/dist ./dist
COPY --from=go_builder /app/server .

EXPOSE 8080
ENV PORT=8080

CMD ["/app/server"]
