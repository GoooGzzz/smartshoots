import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Default base is '/static/' because Django serves the built files under
  // STATIC_URL. The Cloudflare / plain-static-hosting build overrides it from
  // the command line instead: `npm run build:web` (= vite build --base /).
  base: '/static/',
  build: {
    rollupOptions: {
      output: {
        // Only split off the big, self-contained libraries. The previous
        // "vendor-misc"/"vendor-react" catch-all rules created a circular
        // chunk (vendor-misc -> vendor-react -> vendor-misc), which can cause
        // "Cannot access ... before initialization" blank pages. Everything
        // else is left to Rollup's automatic, cycle-free chunking.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/@mui/') || id.includes('/@emotion/')) return 'vendor-mui';
          if (id.includes('/recharts/')) return 'vendor-charts';
          if (id.includes('/xlsx/') || id.includes('/jspdf')) return 'vendor-export';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
