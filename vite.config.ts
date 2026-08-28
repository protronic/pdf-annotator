import {readdirSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {defineConfig} from '@opencloud-eu/extension-sdk';
import {buildInfoDefine} from './build-info';

const pdfjsRoot = dirname(
  createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),
);

/**
 * pdf.js 6.x loads its image decoders (JBIG2, JPEG2000) and the ICC color
 * engine as WASM at runtime from the `wasmUrl`/`iccUrl` document options.
 * The files must keep their original names, so they are copied verbatim
 * into wasm/ and iccs/ next to the bundle (served same-origin, CSP-safe).
 */
const copyPdfjsRuntimeAssets = () => ({
  name: 'pdf-annotator:copy-pdfjs-runtime-assets',
  apply: 'build' as const,
  generateBundle() {
    for (const dir of ['wasm', 'iccs']) {
      for (const file of readdirSync(join(pdfjsRoot, dir))) {
        if (!/\.(wasm|js|icc)$/.test(file)) continue;
        this.emitFile({
          type: 'asset',
          fileName: `${dir}/${file}`,
          source: readFileSync(join(pdfjsRoot, dir, file)),
        });
      }
    }
  },
});

export default defineConfig({
  name: 'pdf-annotator',
  define: buildInfoDefine(),
  plugins: [copyPdfjsRuntimeAssets()],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
});
