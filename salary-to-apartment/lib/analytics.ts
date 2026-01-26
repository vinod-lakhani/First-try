/**
 * Analytics tracking utility
 * For MVP, logs to console. Can be replaced with actual analytics service later.
 */

export function track(eventName: string, payload?: Record<string, any>) {
  // For MVP: console logging
  console.log('[Analytics]', eventName, payload || '');
  
  // TODO: Replace with actual analytics service (e.g., Vercel Analytics, PostHog, etc.)
  // Example:
  // if (typeof window !== 'undefined' && window.analytics) {
  //   window.analytics.track(eventName, payload);
  // }
}
