/**
 * Logger Initialization Component
 * 
 * Ensures the logger is initialized on the client side
 */

'use client';

import { useEffect } from 'react';

export function LoggerInit() {
  useEffect(() => {
    // Initialize logger on client side
    if (typeof window !== 'undefined') {
      import('@/lib/utils/logger').then(() => {
        console.log('Logger initialized');
      });
    }
  }, []);

  return null; // This component doesn't render anything
}

