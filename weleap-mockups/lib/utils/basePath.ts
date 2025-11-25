/**
 * Base path configuration
 * Must match the basePath in next.config.ts
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/First-try';

/**
 * Helper to prefix a path with the basePath
 */
export function withBasePath(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Ensure basePath ends with / or path starts with /
  const base = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
  return `${base}/${cleanPath}`;
}

