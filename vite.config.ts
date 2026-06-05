import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { securityHeaders } from './config/security-headers'

/**
 * Applies the production security headers to the Vite *preview* server only.
 * The dev server is left untouched because Vite HMR needs its own relaxed CSP.
 */
function previewSecurityHeaders(): Plugin {
  return {
    name: 'jca:preview-security-headers',
    configurePreviewServer(server) {
      const headers = securityHeaders()
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value)
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), previewSecurityHeaders()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // No asset is inlined as a data: URI, so the CSP needs no `data:` source.
    assetsInlineLimit: 0,
    sourcemap: false,
    // Fail the build if a chunk is unexpectedly large (catches an accidental
    // heavy dependency landing in the initial bundle — see performance budget).
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/helpers/setup.ts'],
    include: ['tests/unit/**/*.spec.ts', 'tests/integration/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/main.ts', 'src/**/index.ts'],
    },
  },
})
