import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  esbuild: {
    pure: ['console.log', 'console.info', 'console.debug']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true
  }
});
