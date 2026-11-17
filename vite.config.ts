import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import os from 'node:os';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

/**
 * Encodes an unmasked RFC 6455 WebSocket frame for server-to-client transmission.
 */
function encodeWsFrame(data: string | Buffer): Buffer {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const length = payload.length;
  let header: Buffer;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

/**
 * Decodes incoming masked RFC 6455 WebSocket frames from client.
 */
function decodeWsFrames(buffer: Buffer, onMessage: (opcode: number, payload: Buffer) => void): Buffer {
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 2) break;
    const b1 = buffer[offset];
    const b2 = buffer[offset + 1];
    const opcode = b1 & 0x0f;
    const isMasked = (b2 & 0x80) !== 0;
    let payloadLen = b2 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (buffer.length - offset < 4) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (buffer.length - offset < 10) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }

    if (isMasked) headerLen += 4;
    if (buffer.length - offset < headerLen + payloadLen) break;

    let payload: Buffer;
    if (isMasked) {
      const mask = buffer.subarray(offset + headerLen - 4, offset + headerLen);
      payload = Buffer.alloc(payloadLen);
      const raw = buffer.subarray(offset + headerLen, offset + headerLen + payloadLen);
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = raw[i] ^ mask[i % 4];
      }
    } else {
      payload = buffer.subarray(offset + headerLen, offset + headerLen + payloadLen);
    }

    offset += headerLen + payloadLen;
    onMessage(opcode, payload);
  }
  return buffer.subarray(offset);
}

function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Empanel Dedicated WebSocket Relay & LAN Assistant Plugin
 * 1. Hosts a dedicated RFC 6455 WebSocket relay on `/api/relay` for both `dev` and `preview`.
 * 2. Emits LAN IP discovery on `/api/lan-ip` for frictionless mobile QR pairing.
 */
function empanelRelayPlugin(): Plugin {
  const rooms = new Map<string, Set<Socket>>();
  const peerMap = new WeakMap<Socket, string>();

  function attachRelay(httpServer: any) {
    if (!httpServer) return;

    httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      const url = new URL(req.url || '/', 'http://localhost');

      if (url.pathname === '/api/relay') {
        const roomId = url.searchParams.get('room');
        const role = url.searchParams.get('role') || 'viewer';
        const peerId = url.searchParams.get('peer') || '';

        if (!roomId || roomId.length < 8) {
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\nInvalid room');
          socket.destroy();
          return;
        }

        const secKey = req.headers['sec-websocket-key'];
        if (!secKey) {
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing sec-websocket-key');
          socket.destroy();
          return;
        }

        const accept = crypto
          .createHash('sha1')
          .update(secKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64');

        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
        );

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        const room = rooms.get(roomId)!;
        room.add(socket);
        if (peerId) {
          peerMap.set(socket, peerId);
        }

        let incomingBuffer = Buffer.alloc(0);

        socket.on('data', (chunk: Buffer) => {
          incomingBuffer = Buffer.concat([incomingBuffer, chunk]);
          incomingBuffer = decodeWsFrames(incomingBuffer, (opcode, payload) => {
            if (opcode === 8) {
              // Close frame
              socket.end();
              return;
            }
            if (opcode === 9) {
              // Ping -> respond Pong
              socket.write(Buffer.from([0x8a, 0x00]));
              return;
            }
            if (opcode === 1) {
              // Text message: forward raw frame to all other peers in room
              const rawStr = payload.toString('utf8');
              try {
                const parsed = JSON.parse(rawStr);
                if (parsed.type === 'BURN_ROOM') {
                  const burnFrame = encodeWsFrame(rawStr);
                  for (const peer of room) {
                    if (peer !== socket && !peer.destroyed) {
                      try { peer.write(burnFrame); } catch (e) {}
                    }
                    peer.end();
                  }
                  rooms.delete(roomId);
                  return;
                }
              } catch (e) {}

              const frame = encodeWsFrame(payload);
              for (const peer of room) {
                if (peer !== socket && !peer.destroyed) {
                  try {
                    peer.write(frame);
                  } catch (e) {}
                }
              }
            }
          });
        });

        const cleanup = () => {
          const leavingPeerId = peerMap.get(socket) || '';
          room.delete(socket);
          if (room.size === 0) {
            rooms.delete(roomId);
          } else {
            const leaveMsg = encodeWsFrame(JSON.stringify({ type: 'PEER_LEAVE', peerId: leavingPeerId }));
            for (const peer of room) {
              if (!peer.destroyed) {
                try { peer.write(leaveMsg); } catch (e) {}
              }
            }
          }
        };

        socket.on('close', cleanup);
        socket.on('error', cleanup);
      }
    });
  }

  function attachLanIpEndpoint(middlewares: any) {
    if (!middlewares) return;
    middlewares.use('/api/lan-ip', (req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ip: getLanIp(), port: 5173 }));
    });
  }

  return {
    name: 'empanel-relay-server',
    configureServer(server) {
      attachRelay(server.httpServer);
      attachLanIpEndpoint(server.middlewares);

      // Keep Vite HMR custom listener as secondary companion
      server.ws.on('empanel:signal', (payload: any, client: any) => {
        server.ws.clients.forEach((c: any) => {
          if (c !== client && c.socket !== client?.socket) {
            try { c.send('empanel:signal', payload); } catch (e) {}
          }
        });
      });
    },
    configurePreviewServer(server) {
      attachRelay(server.httpServer);
      attachLanIpEndpoint(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), empanelRelayPlugin()],
  server: {
    host: true, // Bind to 0.0.0.0 so other computers on the LAN/Wi-Fi can connect
    port: 5173,
  },
  preview: {
    host: true,
    port: 5173,
  },
});
