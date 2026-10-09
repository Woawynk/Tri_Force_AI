import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    root: 'frontend',
    publicDir: 'public',
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'frontend'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
