/**
 * Biscuit CRM - Zero-Knowledge LAN Star Relay Daemon
 * Relays encrypted delta mutation packets between office workstations.
 * Zero database custody. Zero disk retention. In-memory message routing.
 */
const { createServer } = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.RELAY_PORT || 8080;
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), clients: wss.clients.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress;
  console.log(`[RELAY] Workstation connected from ${remoteIp} (Total active: ${wss.clients.size})`);

  ws.on('message', (data, isBinary) => {
    // Broadcast received delta mutation to all other connected stations
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });

  ws.on('close', () => {
    console.log(`[RELAY] Workstation disconnected (Total active: ${wss.clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[RELAY ERROR]', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` Biscuit CRM LAN Star Relay Daemon Running on Port ${PORT}`);
  console.log(` Zero-Custody Mode: No data persisted to disk`);
  console.log(`=======================================================`);
});
