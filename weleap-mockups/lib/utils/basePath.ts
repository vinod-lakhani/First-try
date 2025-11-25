/**
 * Base path configuration
 * Must match the basePath in next.config.ts
 * 
 * For static export with GitHub Pages, detect basePath at runtime.
 * In development (localhost), basePath is empty.
 * In production (GitHub Pages), basePath is '/First-try'.
 */
function getBasePath(): string {
  // Client-side: detect from current URL
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    // If we're on GitHub Pages and pathname starts with /First-try
    if (pathname.startsWith('/First-try')) {
      return '/First-try';
    }
    // Development or root domain - no basePath
    return '';
  }
  
  // Server-side: use environment variable (for SSR if needed)
  // For static export, this won't run, but safe to include
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Helper to prefix a path with the basePath
 * Works in both development (no prefix) and production (with /First-try prefix)
 */
export function withBasePath(path: string): string {
  const basePath = getBasePath();
  
  // Remove leading slash from path to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If no basePath, just return the path with leading slash
  if (!basePath || basePath === '') {
    return `/${cleanPath}`;
  }
  
  // Ensure basePath doesn't end with /
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  
  // Return the combined path
  return `${base}/${cleanPath}`;
}

