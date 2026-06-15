"""Resolve the real client IP behind the Caddy → nginx proxy chain.

Requests reach Django as client → host Caddy (TLS) → nginx "web"
container → backend, so REMOTE_ADDR is always the web container's
docker-network address and useless for per-client lockout or auditing.
The real client must be recovered from X-Forwarded-For.
"""
from ipaddress import ip_address, ip_network

# Hops owned by our infrastructure, as they appear in X-Forwarded-For:
# Caddy reaches the published port through the docker bridge gateway
# (172.x), and loopback covers healthchecks and on-host tooling.
_TRUSTED_PROXY_NETS = (
    ip_network("127.0.0.0/8"),
    ip_network("::1/128"),
    ip_network("172.16.0.0/12"),  # docker bridge networks
)


def _is_trusted_proxy(addr) -> bool:
    return any(addr in net for net in _TRUSTED_PROXY_NETS)


def axes_client_ip(request):
    """Rightmost non-proxy entry in X-Forwarded-For, else REMOTE_ADDR.

    Walking from the right means a client cannot spoof the result: any
    entries left of the last untrusted hop are attacker-controlled and
    never reached. Caddy (>= 2.5) strips inbound X-Forwarded-For from
    untrusted peers before appending the real client, and nginx appends
    its own peer, so the header arrives here as "<client>, <caddy hop>"
    via the domain, or "<junk...>, <client>" for direct hits on the
    published port 8080.
    """
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    for token in reversed([t.strip() for t in xff.split(",") if t.strip()]):
        try:
            addr = ip_address(token)
        except ValueError:
            break  # malformed entry — trust nothing to its left
        if not _is_trusted_proxy(addr):
            return token
    return request.META.get("REMOTE_ADDR", None)
