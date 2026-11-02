/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // onnxruntime-web loads its own .wasm files, pre-bundling breaks the paths
    exclude: ['onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    headers: {
      // same isolation headers as netlify.toml so multi-threaded wasm works in dev too
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
