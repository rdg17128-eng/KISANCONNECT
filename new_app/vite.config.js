import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import http from 'http'
import { handleCreateOrderRequest, handleVerifyPaymentRequest, handleAutoSuccessPaymentRequest } from './server/razorpayHandler.js'

// Vite plugin: OAuth Port 3000 Redirect Bridge
// Listens on port 3000 across network interfaces (0.0.0.0). When redirected to port 3000,
// this bridge catches the request and forwards to the exact device host on port 5173.
function oauthBridgePlugin() {
  let bridgeServer = null;
  return {
    name: 'oauth-port-3000-bridge',
    configureServer(server) {
      try {
        bridgeServer = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Redirecting to KisanConnect (Port 5173)...</title>
    <script>
        var currentHost = window.location.hostname || 'localhost';
        var origin = 'http://' + currentHost + ':5173';
        var target = origin + window.location.pathname + window.location.search + window.location.hash;
        window.location.replace(target);
    </script>
</head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 2rem; background: #050d09; color: #34d399;">
    <h3>Connecting to KisanConnect...</h3>
    <p style="color: #8ba699;">Forwarding authentication token to port 5173...</p>
</body>
</html>`);
        });

        bridgeServer.listen(3000, '0.0.0.0', () => {
          console.log('\n  ➜  [KisanConnect OAuth Bridge] Listening on 0.0.0.0:3000 -> Forwarding to port 5173\n');
        });

        bridgeServer.on('error', (err) => {
          if (err.code !== 'EADDRINUSE') {
            console.warn('[KisanConnect] Bridge notice:', err.message);
          }
        });
      } catch (e) {
        console.warn('OAuth bridge initialization notice:', e);
      }

      server.httpServer?.on('close', () => {
        bridgeServer?.close();
      });
    }
  };
}

// Vite plugin: Razorpay Standard Web Checkout API Backend
// Handles POST /api/create-order and POST /api/verify-payment during development
function razorpayApiPlugin() {
  return {
    name: 'razorpay-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = req.url ? req.url.split('?')[0] : '';

        if (urlPath === '/api/create-order') {
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
          }

          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
          }

          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const result = await handleCreateOrderRequest(body);
              res.writeHead(result.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result.data));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            }
          });
          return;
        }

        if (urlPath === '/api/verify-payment') {
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
          }

          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
          }

          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const result = await handleVerifyPaymentRequest(body);
              res.writeHead(result.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result.data));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            }
          });
          return;
        }

        if (urlPath === '/api/auto-success-payment') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
          }

          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
          }

          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const result = await handleAutoSuccessPaymentRequest(body);
              res.writeHead(result.status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result.data));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  process.env.VITE_RAZORPAY_KEY_ID = env.VITE_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;

  return {
    plugins: [react(), tailwindcss(), oauthBridgePlugin(), razorpayApiPlugin()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api/ocr': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true
        }
      }
    }
  };
});
