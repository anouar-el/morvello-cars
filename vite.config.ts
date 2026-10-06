import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          // Split heavy third-party libraries into long-lived cacheable chunks
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (id.includes('@firebase') || /[\\/]node_modules[\\/]firebase[\\/]/.test(id)) return 'vendor-firebase';
            if (id.includes('@supabase')) return 'vendor-supabase';
            // Otherwise every icon shared between two lazy views becomes its own tiny request
            if (id.includes('lucide-react')) return 'vendor-icons';
          },
        },
      },
    },
  };
});
