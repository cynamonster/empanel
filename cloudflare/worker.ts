// Cloudflare Worker E2EE WebSocket Relay with Zero-Knowledge Room Routing
// Deployed to Cloudflare Workers to coordinate real-time E2EE pairing.
// ZERO plaintext data touches this worker; all payloads are opaque AES-256-GCM ciphertext.

export interface Env {
  RELAY_ROOMS?: {
    idFromName: (name: string) => any;
    get: (id: any) => any;
  };
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

/**
 * Globally-unique room coordinator using Cloudflare Durable Objects.
 * Guarantees all participants for a room connect to the exact same instance worldwide.
 */
export class RelayRoom {
  ctx: any;
  env: Env;

  constructor(ctx: any, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept using Hibernation API if available, or standard accept
    if (this.ctx && typeof this.ctx.acceptWebSocket === 'function') {
      this.ctx.acceptWebSocket(server);
    } else {
      (server as any).accept();
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const sockets = this.ctx?.getWebSockets ? this.ctx.getWebSockets() : [];
    for (const socket of sockets) {
      if (socket !== ws && socket.readyState === WebSocket.OPEN) {
        socket.send(raw);
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const sockets = this.ctx?.getWebSockets ? this.ctx.getWebSockets() : [];
    for (const socket of sockets) {
      if (socket !== ws && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'PEER_LEAVE' }));
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    try {
      ws.close(1011, 'Relay error');
    } catch (e) {}
  }
}

// Global in-memory fallback for local environments without DO bindings
const fallbackRooms = new Map<string, Set<WebSocket>>();

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

      // 1. Primary: Route to globally unique Durable Object instance
      if (env.RELAY_ROOMS) {
        const id = env.RELAY_ROOMS.idFromName(roomId);
        const roomObj = env.RELAY_ROOMS.get(id);
        return roomObj.fetch(request);
      }

      // 2. Fallback: single-isolate in-memory routing
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();

      if (!fallbackRooms.has(roomId)) {
        fallbackRooms.set(roomId, new Set());
      }
      const room = fallbackRooms.get(roomId)!;
      room.add(server);

      server.addEventListener('message', (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
          for (const peer of room) {
            if (peer !== server && peer.readyState === WebSocket.OPEN) {
              peer.send(raw);
            }
          }
        } catch (e) {
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
          fallbackRooms.delete(roomId);
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
