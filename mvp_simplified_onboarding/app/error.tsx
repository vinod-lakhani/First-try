"use client";

import { useEffect } from "react";

/**
 * Catches runtime errors including the known Webpack chunk error:
 * "Cannot read properties of undefined (reading 'call')"
 * This happens when stale JS chunks are loaded after a deployment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.message?.includes("Cannot read properties of undefined (reading 'call')") ||
    error?.message?.includes("ChunkLoadError") ||
    error?.message?.includes("Loading chunk");

  useEffect(() => {
    if (isChunkError) {
      // Hard refresh loads the latest bundles
      window.location.reload();
      return;
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-400">Loading latest version...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6 text-center max-w-md">
        An unexpected error occurred. Try refreshing the page.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
