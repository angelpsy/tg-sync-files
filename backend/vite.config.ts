import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    target: 'node20',
    ssr: true,
    outDir: 'dist-vite',
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: [
        'pg',
        '@prisma/client',
        'prisma',
        'chokidar',
        'socket.io',
        'big-integer',
        'telegram',
        'input',
      ],
    },
  },
});
