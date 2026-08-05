import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isDevelopmentServer = command === 'serve';

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Enables HTTPS on the dev server so mobile browsers allow getUserMedia.
      // Phones will show a "not trusted" warning on first visit — tap Advanced → Proceed.
      // In production this is replaced by your real SSL certificate.
      ...(isDevelopmentServer ? [basicSsl()] : []),
    ],
    // During local development, make every existing VITE_API_URL reference use
    // the address that opened the page. A phone loading https://192.168.x.x:5173
    // therefore calls that same origin, which Vite proxies to the local API.
    ...(isDevelopmentServer ? {
      define: {
        'import.meta.env.VITE_API_URL': 'window.location.origin',
      },
    } : {}),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: true,
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'ws://127.0.0.1:5000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    assetsInclude: ['**/*.glb', '**/*.gltf'],
    build: {
      assetsInlineLimit: 0, // Don't inline GLB files
    },
  };
})
