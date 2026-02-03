#!/usr/bin/env node
/**
 * Next.js 15 dev server expects .next/server/*.json manifests to exist.
 * With App Router + pages/ (hybrid), the webpack dev build sometimes
 * doesn't create them before the server reads them, causing 500/ENOENT.
 * This script ensures the directory and stub manifests exist before
 * "next dev" runs. Run via: npm run predev or npm run predev:3000
 */
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, '.next', 'server');

const stubs = {
  'middleware-manifest.json': {
    version: 3,
    sortedMiddleware: [],
    middleware: {},
    functions: {},
  },
  'next-font-manifest.json': {
    pages: {},
    app: {},
    appUsingSizeAdjust: false,
    pagesUsingSizeAdjust: false,
  },
  'pages-manifest.json': {},
};

if (!fs.existsSync(path.join(root, '.next'))) {
  fs.mkdirSync(path.join(root, '.next'), { recursive: true });
}
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}

for (const [name, content] of Object.entries(stubs)) {
  const filePath = path.join(serverDir, name);
  const json = JSON.stringify(content, null, 2);
  const existing = (() => {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  })();
  if (existing !== json) {
    fs.writeFileSync(filePath, json, 'utf8');
    console.log('[ensure-next-server-stubs] wrote', name);
  }
}
