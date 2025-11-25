/**
 * Base path configuration
 * Must match the basePath in next.config.ts
 * 
 * For static export with GitHub Pages, we need to handle basePath manually.
 * Next.js will prefix routes but not necessarily static assets like images.
 */

/**
 * Helper to prefix a path with the basePath
 * Works in both development and production
 * 
 * In development (localhost), basePath is empty, so paths are like: /images/ribbit.png
 * In production (GitHub Pages), basePath is /First-try, so paths are like: /First-try/images/ribbit.png
 */
export function withBasePath(path: string): string {
  // Remove leading slash from path to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Client-side: detect basePath from current URL
  if (typeof window !== 'undefined') {
    try {
      const pathname = window.location?.pathname || '';
      // If we're on GitHub Pages (pathname starts with /First-try), use basePath
      if (pathname.startsWith('/First-try')) {
        return `/First-try/${cleanPath}`;
      }
      // Otherwise (development), return path without basePath
      return `/${cleanPath}`;
    } catch (error) {
      // If window.location is not available, fall back to default
      console.warn('Error detecting basePath:', error);
      return `/${cleanPath}`;
    }
  }
  
  // Server-side/build-time: check environment variable
  // For static export, this runs at build time
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BASE_PATH) {
    const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
    if (envBasePath && envBasePath !== '') {
      const base = envBasePath.endsWith('/') ? envBasePath.slice(0, -1) : envBasePath;
      return `${base}/${cleanPath}`;
    }
  }
  
  // Default: return path without basePath (for development)
  return `/${cleanPath}`;
}

