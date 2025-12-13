/**
 * API Configuration
 * Automatically uses the correct API URL for development and production
 */

// In production, use relative URLs (same origin)
// In development, use localhost:3000
export const API_BASE_URL = import.meta.env.PROD
  ? ''
  : 'http://localhost:3000';

console.log('[API Config] Using API base URL:', API_BASE_URL || '(same origin)');
