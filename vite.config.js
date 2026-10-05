import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' يجعل الموقع يعمل على GitHub Pages وأي استضافة ثابتة
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
