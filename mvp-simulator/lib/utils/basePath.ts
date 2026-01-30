export function withBasePath(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `/${clean}`;
}
