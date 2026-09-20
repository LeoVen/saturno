/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project-page subpath (TR-17). Override locally with
  // `BASE_PATH=/` if ever needed, but CI always builds for the real path.
  base: process.env.BASE_PATH ?? '/saturno/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
  },
})
