import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'define-all': resolve(__dirname, 'src/define-all.ts'),
        'elements/circular-sector-layer-svg': resolve(__dirname, 'src/elements/circular-sector-layer-svg.element.ts'),
        'elements/circular-sector-svg': resolve(__dirname, 'src/elements/circular-sector-svg.element.ts'),
        'elements/drag-box': resolve(__dirname, 'src/elements/drag-box.element.ts'),
        'elements/drag-scroll': resolve(__dirname, 'src/elements/drag-scroll.element.ts'),
        'elements/number-aware-input': resolve(__dirname, 'src/elements/number-aware-input.element.ts'),
        'elements/selection-box': resolve(__dirname, 'src/elements/selection-box.element.ts'),
        'elements/transform-box': resolve(__dirname, 'src/elements/transform-box.element.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['lit', /^lit\//, '@casko/circular-sector']
    },
    sourcemap: true
  }
});
