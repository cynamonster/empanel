// Cloudflare Worker E2EE WebSocket Relay with Zero-Knowledge Room Routing
// Deployed to Cloudflare Workers / Pages to support courthouse Wi-Fi client isolation fallback.
// ZERO plaintext data touches this worker; payloads are opaque AES-256-GCM ciphertext.

export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface PeerConnection {
  ws: WebSocket;
  role: string;
}

const rooms = new Map<string, Set<WebSocket>>();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/relay') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket Upgrade', { status: 426 });
      }

      const roomId = url.searchParams.get('room');
      if (!roomId || roomId.length < 8) {
        return new Response('Invalid room identifier', { status: 400 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      const room = rooms.get(roomId)!;

      // Restrict room to max 2 participants (1-to-1 sync for free tier)
      if (room.size >= 2) {
        server.send(JSON.stringify({ type: 'ERROR', message: 'Room full' }));
        server.close(1008, 'Room capacity reached');
        return new Response(null, { status: 101, webSocket: client });
      }

      room.add(server);

      server.addEventListener('message', (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
          const data = JSON.parse(raw);

          // If room is burned, immediately clear room and disconnect
          if (data.type === 'BURN_ROOM') {
            for (const peer of room) {
              if (peer !== server && peer.readyState === WebSocket.OPEN) {
                peer.send(raw);
              }
              peer.close(1000, 'Room burned');
            }
            rooms.delete(roomId);
            return;
          }

          // Forward message to all other peers in the room
          for (const peer of room) {
            if (peer !== server && peer.readyState === WebSocket.OPEN) {
              peer.send(raw);
            }
          }
        } catch (e) {
          // If non-JSON, forward raw
          for (const peer of room) {
            if (peer !== server && peer.readyState === WebSocket.OPEN) {
              peer.send(event.data);
            }
          }
        }
      });

      const cleanup = () => {
        room.delete(server);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          for (const peer of room) {
            if (peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({ type: 'PEER_LEAVE' }));
            }
          }
        }
      };

      server.addEventListener('close', cleanup);
      server.addEventListener('error', cleanup);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Empanel E2EE Relay Online', { status: 200 });
  },
};
