/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from the custom domain saturno.leoven.dev (root path), per
  // app/public/CNAME and the GitHub Pages custom-domain setting — see
  // impls/DECISIONS.md D-06. Override locally with `BASE_PATH=/x/` if ever
  // needed (e.g. testing the old project-page subpath).
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
  },
})
