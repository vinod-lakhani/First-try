"use client";

import { useEffect } from "react";

/**
 * Catches the Webpack chunk error that occurs when stale JS is loaded after deployment.
 * Error: "Cannot read properties of undefined (reading 'call')"
 * Triggers a reload so the user gets the latest bundles.
 */
export function ChunkErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = event.message ?? "";
      if (
        msg.includes("Cannot read properties of undefined (reading 'call')") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk")
      ) {
        event.preventDefault();
        window.location.reload();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message ?? event.reason ?? "");
      if (
        msg.includes("Cannot read properties of undefined (reading 'call')") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk")
      ) {
        event.preventDefault();
        window.location.reload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
