import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Identifies this build; also written to version.json, which a running TV checks to
// reload itself when a newer build is deployed (src/shared/hooks/useReloadOnUpdate.ts)
const BUILD_ID = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  define: {
    'process.env': {},
    __BUILD_ID__: JSON.stringify(BUILD_ID)
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      }
    }
  ],
  build: {
    // One file on purpose (~180 kB gzipped, mostly React): a deploy replaces every file,
    // so a TV left running an old build would fail to load a split-off chunk
    chunkSizeWarningLimit: 800
  },
  server: {
    port: 5173,
    host: true
  }
});
