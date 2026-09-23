"""The two pieces of cloudflare-only.sh that are easier to get right in Python.

    python3 cloudflare_only.py allow-list < cloudflare-ips.json > allow.conf
    python3 cloudflare_only.py patch-site SITE ALLOW_FILE > patched-site

Neither writes anywhere but stdout; the shell script decides what replaces what.
"""

import ipaddress
import json
import re
import sys

FORWARDED_FROM_CLIENT = "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
FORWARDED_FROM_CLOUDFLARE = "proxy_set_header X-Forwarded-For $http_cf_connecting_ip;"


def allow_list(answer: dict) -> str:
    """nginx allow lines for Cloudflare's ranges, then deny for everything else."""
    if not answer.get("success"):
        raise SystemExit("Cloudflare did not answer with its address list")
    result = answer["result"]
    # Cloudflare publishes about fifteen IPv4 and seven IPv6 ranges. A list much
    # shorter than that is a truncated answer, and would lock the site out.
    if len(result["ipv4_cidrs"]) < 10 or len(result["ipv6_cidrs"]) < 5:
        raise SystemExit("the address list is suspiciously short; not using it")
    # ip_network refuses anything that is not a range, so nothing else can be
    # written into nginx's configuration by way of this list.
    ranges = [str(ipaddress.ip_network(cidr)) for cidr in result["ipv4_cidrs"] + result["ipv6_cidrs"]]
    lines = ["# Written by deploy/cloudflare-only.sh from Cloudflare's own list. Do not edit."]
    lines += [f"allow {cidr};" for cidr in ranges]
    lines.append("deny all;")
    return "\n".join(lines) + "\n"


def server_blocks(text: str) -> list:
    """Top-level `server { ... }` blocks, as (start, end) offsets."""
    found, depth, start = [], 0, None
    for match in re.finditer(r"server\s*\{|\{|\}", text):
        token = match.group(0)
        if start is None:
            if token.startswith("server"):
                start, depth = match.start(), 1
        elif token == "}":
            depth -= 1
            if depth == 0:
                found.append((start, match.end()))
                start = None
        else:
            depth += 1
    return found


def patch_site(text: str, allow_file: str) -> str:
    """The site file with the bare domain's HTTPS block restricted to Cloudflare."""
    targets = [
        (start, end)
        for start, end in server_blocks(text)
        if re.search(r"^\s*server_name\s+liquiditywise\.com;", text[start:end], re.M)
        and re.search(r"listen\s+443", text[start:end])
        and "proxy_pass" in text[start:end]
    ]
    if len(targets) != 1:
        raise SystemExit(
            f"expected one HTTPS block for liquiditywise.com, found {len(targets)}; run this after certbot"
        )
    start, end = targets[0]
    block = text[start:end]
    include = f"include {allow_file};"
    if include not in block:
        block = re.sub(
            r"(^\s*server_name\s+liquiditywise\.com;\n)",
            lambda match: f"{match.group(1)}\n    {include}\n",
            block,
            count=1,
            flags=re.M,
        )
    block = block.replace(FORWARDED_FROM_CLIENT, FORWARDED_FROM_CLOUDFLARE)
    return text[:start] + block + text[end:]


if __name__ == "__main__":
    if sys.argv[1:2] == ["allow-list"]:
        sys.stdout.write(allow_list(json.load(sys.stdin)))
    elif sys.argv[1:2] == ["patch-site"] and len(sys.argv) == 4:
        with open(sys.argv[2], encoding="utf-8") as handle:
            sys.stdout.write(patch_site(handle.read(), sys.argv[3]))
    else:
        raise SystemExit(__doc__)
