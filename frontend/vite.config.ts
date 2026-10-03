import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // FIX: Django serves static files under /static/ (STATIC_URL), but Vite's
  // default base ('/') built asset URLs like /assets/index-xxx.js at the
  // root. Those didn't start with "static/", so Django's SPA catch-all
  // route (urls.py) swallowed the request and returned index.html instead
  // of the actual JS bundle - the page loaded but the script never ran,
  // which is why it looked like a blank white page with nothing wrong in
  // the console-visible network tab (wrong content, 200 status).
  base: '/static/',
  build: {
    rollupOptions: {
      output: {
        // FIX/NEW (performance): route-level lazy() in App.tsx already
        // stops every page's code from loading up front - this groups
        // the big third-party libraries into their own cacheable chunks
        // too, so a future deploy that only changes app code doesn't
        // force everyone to re-download MUI/recharts/etc. again, and the
        // browser can fetch several smaller files in parallel instead of
        // one huge one.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('xlsx') || id.includes('jspdf')) return 'vendor-export';
          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
          return 'vendor-misc';
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
