#!/bin/sh
set -e

mkdir -p /var/run/tailscale /var/lib/tailscale /dev/net
[ -c /dev/net/tun ] || mknod /dev/net/tun c 10 200

sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
sysctl -w net.ipv6.conf.all.forwarding=1 >/dev/null 2>&1 || true

tailscaled \
  --state=/var/lib/tailscale/tailscaled.state \
  --socket=/var/run/tailscale/tailscaled.sock \
  --tun=tailscale0 &

until [ -S /var/run/tailscale/tailscaled.sock ]; do
  sleep 0.3
done
sleep 1

tailscale --socket=/var/run/tailscale/tailscaled.sock up \
  --authkey="${TS_AUTHKEY}" \
  --hostname="${TS_HOSTNAME:-xpilot-weixin-worker}" \
  --advertise-exit-node \
  --accept-dns=false \
  --reset

exec node dist/index.js
