import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Perpetual-Desktop/' : '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5190 },
  build: { target: 'es2022' },
});
