import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'define-all': resolve(__dirname, 'src/define-all.ts'),
        'elements/angle-input': resolve(__dirname, 'src/elements/angle-input.element.ts'),
        'elements/anchor-point-input': resolve(__dirname, 'src/elements/anchor-point-input.element.ts'),
        'elements/background-colors': resolve(__dirname, 'src/elements/background-colors.element.ts'),
        'elements/circular-decoration-input': resolve(__dirname, 'src/elements/circular-decoration-input.element.ts'),
        'elements/circular-input': resolve(__dirname, 'src/elements/circular-input.element.ts'),
        'elements/circular-sector-layer-svg': resolve(__dirname, 'src/elements/circular-sector-svg/circular-sector-layer-svg.element.ts'),
        'elements/circular-sector-svg': resolve(__dirname, 'src/elements/circular-sector-svg/circular-sector-svg.element.ts'),
        'elements/circular-text-input': resolve(__dirname, 'src/elements/circular-text-input.element.ts'),
        'elements/drag-box': resolve(__dirname, 'src/elements/drag-box/drag-box.element.ts'),
        'elements/drag-scroll': resolve(__dirname, 'src/elements/drag-scroll.element.ts'),
        'elements/fill-input': resolve(__dirname, 'src/elements/fill-input.element.ts'),
        'elements/number-aware-input': resolve(__dirname, 'src/elements/number-aware-input.element.ts'),
        'elements/range-thing': resolve(__dirname, 'src/elements/range-thing.element.ts'),
        'elements/selection-box': resolve(__dirname, 'src/elements/selection-box.element.ts'),
        'elements/stroke-input': resolve(__dirname, 'src/elements/stroke-input.element.ts'),
        'elements/text-input': resolve(__dirname, 'src/elements/text-input.element.ts'),
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
