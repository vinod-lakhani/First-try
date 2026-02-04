# Dev Server Troubleshooting

## Runtime Error: ENOENT `.next/server/pages/_document.js`

This error appears when Next.js can't find the compiled `_document.js` file. It often happens when:

1. **Multiple lockfiles** – The repo is opened at the parent folder (e.g. `First-try`) which has its own `package-lock.json`, so Next.js infers the wrong project root and doesn't create `.next/server` correctly in `MVP_rev1`.

2. **Corrupted or incomplete `.next` cache** – Stale or mixed Turbopack/webpack artifacts.

### What we've done in the project

- **`next.config.ts`** – `outputFileTracingRoot` is set so Next.js uses `MVP_rev1` as the project root.
- **`pages/_document.tsx` and `pages/_app.tsx`** – Minimal Pages Router files so the error overlay and fallback routes have a document to compile.
- **`npm run dev`** – Uses webpack (no Turbopack) for more reliable dev builds.
- **Type fixes** – `searchParams` is guarded with `?.` where it can be null (`useSearchParams()` in Next 15).

### Recommended workarounds

1. **Open only the app folder**  
   In Cursor/VS Code: **File → Open Folder** and choose `MVP_rev1` (not the parent `First-try`). Then in the terminal run:
   ```bash
   npm run dev
   ```
   With only `MVP_rev1` open, there’s no parent lockfile, so Next.js should use the correct root and create `.next/server` as expected.

2. **Clean and restart**  
   If you still see the error:
   ```bash
   cd MVP_rev1
   rm -rf .next
   npm run dev -- -p 3000
   ```

3. **Use webpack, not Turbopack**  
   Use `npm run dev` (webpack). Avoid `npm run dev:turbo` for now; Turbopack can trigger ENOENT on build manifests in this setup.

### Internal Server Error / ENOENT `middleware-manifest.json` or `next-font-manifest.json`

Next.js 15 dev can start before it writes `.next/server/` and the manifest files. When you hit a route (or a 404), the server then tries to read those files and throws 500/ENOENT.

**Automatic fix (recommended):**  
`npm run dev` and `npm run dev:3000` now run a pre-script that creates `.next/server/` and stub manifests if missing. Just restart the dev server:

```bash
# Stop the current server (Ctrl+C), then:
npm run dev:3000
```

**Manual fix:**  
If you ever need to fix it without restarting:

```bash
node scripts/ensure-next-server-stubs.js
```

Then refresh the browser. The script is in `scripts/ensure-next-server-stubs.js`.

### If production build fails (e.g. `pages-manifest.json` ENOENT)

The same root-cause (inferred workspace root / multiple lockfiles) can make `npm run build` fail during "Collecting page data". Building from a workspace that only contains `MVP_rev1` (e.g. clone or open only `MVP_rev1`) usually fixes it. Vercel and other hosts typically build from the repo root; if the repo root is `MVP_rev1`, the build should succeed there.
