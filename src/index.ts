/**
 * @pleme/observability
 *
 * CNCF-aligned frontend observability with telemetry, metrics, and Web Vitals.
 *
 * @example
 * ```ts
 * import { createObservability, reportWebVitals } from '@pleme/observability'
 *
 * // Create an observability instance
 * const observability = createObservability({
 *   telemetryEndpoint: '/api/telemetry',
 *   debug: true,
 * })
 *
 * // Report Web Vitals
 * reportWebVitals(observability)
 *
 * // Track events
 * observability.trackEvent('button_clicked', { buttonId: 'submit' })
 *
 * // Track metrics
 * observability.trackMetric('api.latency', 150, 'good', { endpoint: '/users' })
 *
 * // Track errors
 * observability.trackError('api.error', error, { endpoint: '/users' })
 *
 * // Capture exceptions (for error boundaries)
 * observability.captureException(error, { component: 'UserList' })
 *
 * // Cleanup on unmount
 * observability.cleanup()
 * ```
 */

// Types
export type {
  TelemetryType,
  TelemetryEvent,
  MetricRating,
  ObservabilityConfig,
  ObservabilityInstance,
} from './types'

// Core telemetry
export { createObservability } from './telemetry'

// Session utilities
export { getSessionId, getCurrentPage, isDevelopment, resetSessionCache } from './session'

// Web Vitals
export { reportWebVitals } from './web-vitals'
