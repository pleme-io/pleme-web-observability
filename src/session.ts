/**
 * Session Management
 *
 * Session ID generation and page tracking utilities.
 */

let cachedSessionId: string | null = null

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Get or create a session ID for tracking
 * Uses sessionStorage for persistence within the browser session
 */
export function getSessionId(sessionKey: string): string {
  if (cachedSessionId) {
    return cachedSessionId
  }

  if (typeof window === 'undefined') {
    cachedSessionId = 'ssr'
    return cachedSessionId
  }

  let sessionId = sessionStorage.getItem(sessionKey)

  if (!sessionId) {
    sessionId = generateSessionId()
    sessionStorage.setItem(sessionKey, sessionId)
  }

  cachedSessionId = sessionId
  return sessionId
}

/**
 * Reset the cached session ID (useful for testing)
 */
export function resetSessionCache(): void {
  cachedSessionId = null
}

/**
 * Get the current page path
 */
export function getCurrentPage(): string {
  if (typeof window === 'undefined') {
    return '/'
  }
  return window.location.pathname
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // Check window.ENV first (runtime config from K8s)
  const windowEnv = (window as { ENV?: { VITE_ENV?: string } }).ENV
  if (windowEnv?.VITE_ENV) {
    return windowEnv.VITE_ENV === 'development'
  }

  // Check for common development indicators
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local')
  )
}
