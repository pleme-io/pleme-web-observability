/**
 * Observability Types
 *
 * Core type definitions for the CNCF-aligned observability system.
 */

export type TelemetryType = 'metric' | 'event' | 'error' | 'trace'
export type MetricRating = 'good' | 'needs-improvement' | 'poor'

export interface TelemetryEvent {
  type: TelemetryType
  name: string
  value?: number | undefined
  rating?: MetricRating | undefined
  properties?: Record<string, unknown> | undefined
  timestamp: number
  sessionId: string
  page: string
}

export interface ObservabilityConfig {
  /** Enable console logging in development */
  debug: boolean
  /** Batch size before flush */
  batchSize: number
  /** Max time (ms) to hold events before flush */
  flushInterval: number
  /** Telemetry endpoint URL (relative to origin) */
  telemetryEndpoint: string
  /** Enable beacon on page unload */
  useBeacon: boolean
  /** Session storage key for session ID */
  sessionKey: string
  /** Custom session ID provider (optional) */
  sessionIdProvider?: () => string
  /** Custom page provider (optional) */
  pageProvider?: () => string
  /** Custom isDevelopment check (optional) */
  isDevelopmentProvider?: () => boolean
}

export interface ObservabilityInstance {
  trackMetric: (
    name: string,
    value: number,
    rating?: MetricRating,
    properties?: Record<string, unknown>
  ) => void
  trackEvent: (name: string, properties?: Record<string, unknown>) => void
  trackError: (
    name: string,
    error: unknown,
    properties?: Record<string, unknown>
  ) => void
  trackTrace: (name: string, properties?: Record<string, unknown>) => void
  captureException: (error: unknown, context?: Record<string, unknown>) => void
  trackPageView: (path: string, properties?: Record<string, unknown>) => void
  flush: () => void
  cleanup: () => void
  getSessionId: () => string
}
