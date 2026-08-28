import vue from '@vitejs/plugin-vue';
import {defineConfig} from 'vite';
import {buildInfoDefine} from './build-info';

// Dev-only config for test/harness: mounts src/App.vue the same way the
// OpenCloud AppWrapper does, without Module Federation.
export default defineConfig({
  root: 'test/harness',
  plugins: [vue()],
  define: buildInfoDefine(),
  // Serves the package root so /wasm/* and /iccs/* resolve like in the
  // production bundle (image decoders + ICC engine, see vite.config.ts).
  publicDir: '../../node_modules/pdfjs-dist',
  server: {
    port: 5299,
    strictPort: true,
  },
});
