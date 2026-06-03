/**
 * Rollup manualChunks policy for production builds.
 *
 * DO NOT split React, react-dom, react-router, Fluent UI, or other React-coupled
 * packages into separate vendor chunks — that created a chunk cycle and broke
 * hooks (undefined useState in production).
 *
 * Only heavy, leaf libraries that are not part of the React singleton graph
 * get dedicated async/cache chunks. Everything else uses Rollup defaults.
 *
 * Enforced by: npm run verify:chunks (runs before vite build).
 */

/** The only chunk names manualChunks may return. */
export const ALLOWED_VENDOR_CHUNKS = new Set([
  'vendor-pdf',
  'vendor-calendar',
  'vendor-canvas',
])

const FORBIDDEN_CHUNK_MARKERS = [
  '/react/',
  '/react-dom/',
  'react/jsx-runtime',
  '/scheduler/',
  'react-router',
  '@fluentui/',
]

/**
 * @param {string} id - Resolved module id from Rollup
 * @returns {string | undefined}
 */
export function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined

  if (FORBIDDEN_CHUNK_MARKERS.some((marker) => id.includes(marker))) {
    return undefined
  }

  if (id.includes('pdfjs-dist')) return 'vendor-pdf'
  if (id.includes('@fullcalendar')) return 'vendor-calendar'
  if (
    id.includes('fabric')
    || id.includes('html2canvas')
    || id.includes('cropperjs')
  ) {
    return 'vendor-canvas'
  }

  return undefined
}
