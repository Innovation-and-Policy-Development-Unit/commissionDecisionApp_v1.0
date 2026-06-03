#!/usr/bin/env node
/**
 * Guardrail: keep manualChunks policy from re-splitting React (production hook crash).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALLOWED_VENDOR_CHUNKS, manualChunks } from '../vite.manualChunks.js'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const policyPath = join(frontendRoot, 'vite.manualChunks.js')
const configPath = join(frontendRoot, 'vite.config.js')

const policySrc = readFileSync(policyPath, 'utf8')
const configSrc = readFileSync(configPath, 'utf8')

let failed = false
const fail = (msg) => {
  console.error(`verify-vite-chunks: ${msg}`)
  failed = true
}

if (!configSrc.includes("from './vite.manualChunks.js'")) {
  fail('vite.config.js must import manualChunks from ./vite.manualChunks.js')
}

if (/\bmanualChunks\s*\(/.test(configSrc)) {
  fail('vite.config.js must not define manualChunks inline — use vite.manualChunks.js')
}

for (const match of policySrc.matchAll(/return\s+['"]([^'"]+)['"]/g)) {
  const name = match[1]
  if (!ALLOWED_VENDOR_CHUNKS.has(name)) {
    fail(`unexpected manualChunks return "${name}" — allowed: ${[...ALLOWED_VENDOR_CHUNKS].join(', ')}`)
  }
}

const reactProbe = '/node_modules/react/index.js'
const reactDomProbe = '/node_modules/react-dom/index.js'
const routerProbe = '/node_modules/react-router-dom/dist/index.js'

if (manualChunks(reactProbe) !== undefined) {
  fail('React must not be assigned to a manual chunk')
}
if (manualChunks(reactDomProbe) !== undefined) {
  fail('react-dom must not be assigned to a manual chunk')
}
if (manualChunks(routerProbe) !== undefined) {
  fail('react-router-dom must not be assigned to a manual chunk')
}

if (manualChunks('/node_modules/pdfjs-dist/build/pdf.mjs') !== 'vendor-pdf') {
  fail('pdfjs-dist must map to vendor-pdf')
}
if (manualChunks('/node_modules/@fullcalendar/core/index.js') !== 'vendor-calendar') {
  fail('@fullcalendar must map to vendor-calendar')
}
if (manualChunks('/node_modules/fabric/dist/index.min.mjs') !== 'vendor-canvas') {
  fail('fabric must map to vendor-canvas')
}

if (failed) {
  process.exit(1)
}

console.log('verify-vite-chunks: OK (React default graph; vendor-pdf, vendor-calendar, vendor-canvas only)')
