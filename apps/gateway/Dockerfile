# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY apps/gateway/go.mod apps/gateway/go.sum ./
RUN go mod download
COPY apps/gateway/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/gateway ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget \
    && addgroup -S app \
    && adduser -S -G app app
WORKDIR /app
COPY --from=build /out/gateway /app/gateway
COPY --chown=app:app infra/migrations /app/migrations
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
CMD ["/app/gateway"]
