import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  },
  test: {
    include: ['src/**/*.test.ts'],
    alias: {
      '$server': '/src/lib/server',
      '$lib': '/src/lib',
    },
  },
});
