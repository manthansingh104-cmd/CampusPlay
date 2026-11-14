import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
  build: {
    // The PDF engine is loaded only when an organiser requests a PDF export.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/recharts/')) return 'charts'
          if (id.includes('/node_modules/core-js/')) return 'pdf-runtime'
          if (/\/node_modules\/(jspdf|fast-png|fflate|canvg|dompurify|html2canvas|rgbcolor|svg-pathdata|stackblur-canvas|svg2pdf\.js)\//.test(id) || id.includes('/node_modules/@babel/runtime/')) return 'pdf'
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
          if (id.includes('/node_modules/')) return 'vendor'
        },
      },
    },
  },
})
