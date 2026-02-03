/**
 * Performance Utilities
 * 
 * Helper functions for performance optimization.
 */

/**
 * Disable console.log in production to improve performance
 */
export const shouldLog = process.env.NODE_ENV === 'development';

/**
 * Conditional console.log that only logs in development
 */
export function debugLog(...args: any[]) {
  if (shouldLog) {
    console.log(...args);
  }
}

/**
 * Conditional console.warn that only warns in development
 */
export function debugWarn(...args: any[]) {
  if (shouldLog) {
    console.warn(...args);
  }
}

/**
 * Conditional console.error that only errors in development
 */
export function debugError(...args: any[]) {
  if (shouldLog) {
    console.error(...args);
  }
}

