import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Lets .svelte.ts modules — the view-model stores — be tested with their runes compiled, so
  // store behaviour is verifiable instead of only inspectable.
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main')
    }
  },
  test: {
    include: ['test/**/*.test.ts'],
    server: { deps: { inline: ['svelte'] } },
    benchmark: { include: ['bench/**/*.bench.ts'] },
    coverage: {
      provider: 'v8',
      include: ['src/shared/**', 'src/main/query/**', 'src/main/library/**'],
      thresholds: { lines: 70, functions: 70, branches: 60 }
    }
  }
})
