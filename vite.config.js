import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: false,
  plugins: [
    {
      name: 'serve-static-prefix',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/static/')) {
            req.url = req.url.replace(/^\/static/, '');
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '/static': path.resolve(__dirname, '.')
    }
  },
  css: {
    postcss: {
      plugins: []
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
});
