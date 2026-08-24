import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  root: 'src',
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'definition-editor': new URL('./src/definition-editor/index.html', import.meta.url).pathname,
        'render-designer': new URL('./src/render-designer/index.html', import.meta.url).pathname,
        'form-runtime': new URL('./src/form-runtime/index.html', import.meta.url).pathname,
      },
    },
  },
});
