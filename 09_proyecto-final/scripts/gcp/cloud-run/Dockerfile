FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-ec", ": \"${ORIGIN_HOST:?Configure ORIGIN_HOST with the origin TLS hostname}\"; : \"${PUBLIC_DOMAIN:?Configure PUBLIC_DOMAIN with the canonical public hostname}\"; exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
