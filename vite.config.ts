import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Empanel Dev Signaling Relay Plugin
 * Uses Vite's built-in HMR WebSocket server to relay encrypted signaling messages
 * across any browser, tab, or separate computer connected to the dev server on LAN/Wi-Fi.
 */
function empanelDevRelayPlugin(): Plugin {
  return {
    name: 'empanel-dev-relay',
    configureServer(server) {
      server.ws.on('empanel:signal', (payload: any, client: any) => {
        // Forward message to all other connected clients
        server.ws.clients.forEach((c: any) => {
          if (c !== client) {
            c.send('empanel:signal', payload);
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), empanelDevRelayPlugin()],
  server: {
    host: true, // Bind to 0.0.0.0 so other computers on the LAN/Wi-Fi can connect
    port: 5173,
  },
});
