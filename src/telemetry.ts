/**
 * Telemetry Core
 *
 * Non-blocking event collection, batching, and delivery to CNCF backends.
 *
 * Architecture:
 * 1. Events collected into in-memory queue (non-blocking)
 * 2. Background batching via requestIdleCallback
 * 3. Delivery via fetch or Beacon API on page unload
 * 4. Backend: Hanabi BFF -> Prometheus/Loki/Tempo -> Grafana
 */

import type { TelemetryEvent, ObservabilityConfig, ObservabilityInstance, MetricRating } from './types'
import { getSessionId, getCurrentPage, isDevelopment, resetSessionCache } from './session'

const DEFAULT_CONFIG: ObservabilityConfig = {
  debug: false,
  batchSize: 10,
  flushInterval: 5000, // 5 seconds
  telemetryEndpoint: '/api/telemetry',
  useBeacon: true,
  sessionKey: 'pleme_session_id',
}

/**
 * Create an observability instance with the given configuration.
 * This is the main factory function for the observability system.
 */
export function createObservability(
  options: Partial<ObservabilityConfig> = {}
): ObservabilityInstance {
  const config: ObservabilityConfig = { ...DEFAULT_CONFIG, ...options }

  // Determine debug mode
  const isDebug = config.debug || (config.isDevelopmentProvider?.() ?? isDevelopment())

  let eventQueue: TelemetryEvent[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let isInitialized = false
  let boundHandleVisibilityChange: (() => void) | null = null
  let boundFlushWithBeacon: (() => void) | null = null

  // Circuit breaker state
  let consecutiveFailures = 0
  let backoffUntil = 0
  let lastErrorLogged = 0
  const MAX_BACKOFF_MS = 5 * 60 * 1000 // 5 minutes
  const ERROR_LOG_INTERVAL_MS = 60_000 // suppress duplicate logs for 60s

  // Session and page providers
  const getSession = config.sessionIdProvider ?? (() => getSessionId(config.sessionKey))
  const getPage = config.pageProvider ?? getCurrentPage

  /**
   * Collect a telemetry event into the queue.
   * This is completely non-blocking and returns immediately.
   */
  function collect(event: Omit<TelemetryEvent, 'timestamp' | 'sessionId' | 'page'>): void {
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: getSession(),
      page: getPage(),
    }

    eventQueue.push(fullEvent)

    if (isDebug) {
      console.log('[Observability]', event.type, event.name, event.properties ?? event.value ?? '')
    }

    // Check if we should flush
    if (eventQueue.length >= config.batchSize) {
      scheduleFlush()
    } else if (!flushTimer) {
      // Schedule a flush after interval
      flushTimer = setTimeout(scheduleFlush, config.flushInterval)
    }
  }

  /**
   * Schedule a flush using requestIdleCallback for background processing.
   */
  function scheduleFlush(): void {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }

    if (eventQueue.length === 0) {
      return
    }

    // Use requestIdleCallback for background processing
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(flush, { timeout: 2000 })
    } else {
      // Fallback to setTimeout with 0 delay
      setTimeout(flush, 0)
    }
  }

  /**
   * Calculate backoff delay with exponential increase.
   */
  function getBackoffDelay(): number {
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s, capped at MAX_BACKOFF_MS
    const delay = Math.min(5000 * Math.pow(2, consecutiveFailures - 1), MAX_BACKOFF_MS)
    return delay
  }

  /**
   * Flush the event queue to the telemetry endpoint.
   */
  async function flush(): Promise<void> {
    if (eventQueue.length === 0) {
      return
    }

    // Circuit breaker: skip if in backoff period
    const now = Date.now()
    if (now < backoffUntil) {
      // Still in backoff — schedule a retry after the backoff expires
      if (!flushTimer) {
        flushTimer = setTimeout(scheduleFlush, backoffUntil - now)
      }
      return
    }

    const events = [...eventQueue]
    eventQueue = []

    if (isDebug) {
      console.log('[Observability] Flushing', events.length, 'events')
    }

    try {
      const response = await fetch(config.telemetryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      })

      if (!response.ok) {
        throw new Error(`Telemetry request failed: ${response.status}`)
      }

      // Success — reset circuit breaker
      if (consecutiveFailures > 0 && isDebug) {
        console.log('[Observability] Telemetry recovered after', consecutiveFailures, 'failures')
      }
      consecutiveFailures = 0
      backoffUntil = 0
    } catch (error) {
      consecutiveFailures++

      // Re-queue failed events (but don't exceed 100 total to bound memory)
      const spaceLeft = 100 - eventQueue.length
      if (spaceLeft > 0) {
        eventQueue.push(...events.slice(0, spaceLeft))
      }

      // Apply exponential backoff
      const delay = getBackoffDelay()
      backoffUntil = Date.now() + delay

      // Suppress duplicate error logs (log at most once per minute)
      const logNow = Date.now()
      if (logNow - lastErrorLogged >= ERROR_LOG_INTERVAL_MS) {
        lastErrorLogged = logNow
        console.warn(
          `[Observability] Telemetry send failed (attempt ${consecutiveFailures}, retry in ${Math.round(delay / 1000)}s):`,
          error instanceof Error ? error.message : error
        )
      }

      // Schedule retry after backoff
      if (!flushTimer) {
        flushTimer = setTimeout(scheduleFlush, delay)
      }
    }
  }

  /**
   * Flush using Beacon API (for page unload).
   */
  function flushWithBeacon(): void {
    if (eventQueue.length === 0 || !config.useBeacon) {
      return
    }

    const events = [...eventQueue]
    eventQueue = []

    if (isDebug) {
      console.log('[Observability] Beacon flush', events.length, 'events')
    }

    const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' })
    navigator.sendBeacon(config.telemetryEndpoint, blob)
  }

  /**
   * Initialize event listeners for page unload.
   */
  function init(): void {
    if (isInitialized || typeof window === 'undefined') {
      return
    }

    if (config.useBeacon) {
      boundHandleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          flushWithBeacon()
        }
      }
      boundFlushWithBeacon = flushWithBeacon

      window.addEventListener('visibilitychange', boundHandleVisibilityChange)
      window.addEventListener('beforeunload', boundFlushWithBeacon)
    }

    isInitialized = true

    if (isDebug) {
      console.log('[Observability] Initialized with config:', config)
    }
  }

  // Auto-initialize
  init()

  // Return the public API
  return {
    trackMetric(
      name: string,
      value: number,
      rating?: MetricRating,
      properties?: Record<string, unknown>
    ): void {
      collect({ type: 'metric', name, value, rating, properties })
    },

    trackEvent(name: string, properties?: Record<string, unknown>): void {
      collect({ type: 'event', name, properties })
    },

    trackError(
      name: string,
      error: unknown,
      properties?: Record<string, unknown>
    ): void {
      collect({
        type: 'error',
        name,
        properties: {
          ...properties,
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      })
    },

    trackTrace(name: string, properties?: Record<string, unknown>): void {
      collect({ type: 'trace', name, properties })
    },

    captureException(error: unknown, context?: Record<string, unknown>): void {
      this.trackError('exception', error, context)
      console.error('[Observability] Exception captured:', error)
    },

    trackPageView(path: string, properties?: Record<string, unknown>): void {
      this.trackEvent('page_view', { path, ...properties })
    },

    flush(): void {
      scheduleFlush()
    },

    cleanup(): void {
      if (typeof window !== 'undefined') {
        if (boundHandleVisibilityChange) {
          window.removeEventListener('visibilitychange', boundHandleVisibilityChange)
          boundHandleVisibilityChange = null
        }
        if (boundFlushWithBeacon) {
          window.removeEventListener('beforeunload', boundFlushWithBeacon)
          boundFlushWithBeacon = null
        }
      }

      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }

      isInitialized = false
      resetSessionCache()

      if (isDebug) {
        console.log('[Observability] Cleaned up')
      }
    },

    getSessionId(): string {
      return getSession()
    },
  }
}
