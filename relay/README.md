# Biscuit CRM - Zero-Knowledge On-Premises Star Relay

Deploy this daemon on any local office workstation, mini PC, NAS, or server to coordinate 100+ concurrent workstations over the office LAN without cloud vendor database hosting.

### Quick Start (Node.js)
```bash
cd relay
npm install ws
node server.js
```

### Quick Start (Docker)
```bash
cd relay
docker compose up -d
```

All connected workstations point their "Fleet Hub (100+)" modal to `ws://<HOST_IP>:8080`.
