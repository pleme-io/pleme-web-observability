/**
 * Web Vitals Integration
 *
 * Report Core Web Vitals metrics to the observability system.
 * Uses dynamic import to avoid loading web-vitals if not needed.
 */

import type { ObservabilityInstance, MetricRating } from './types'

interface WebVitalsMetric {
  name: string
  value: number
  rating: MetricRating
}

/**
 * Report Web Vitals metrics to the observability instance.
 * Call this early in app initialization.
 *
 * @param observability - The observability instance to report metrics to
 * @param debug - Whether to log metrics to console
 */
export async function reportWebVitals(
  observability: ObservabilityInstance,
  debug = false
): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals')

    const handleMetric = (metric: WebVitalsMetric) => {
      // Get navigation type if available
      const navigationEntries = performance.getEntriesByType('navigation')
      const navigationEntry = navigationEntries[0]
      const navigationType =
        navigationEntry && 'type' in navigationEntry
          ? (navigationEntry as PerformanceNavigationTiming).type
          : undefined

      observability.trackMetric(metric.name, metric.value, metric.rating, {
        navigationType,
      })
    }

    onCLS(handleMetric)
    onFCP(handleMetric)
    onLCP(handleMetric)
    onTTFB(handleMetric)
    onINP(handleMetric)

    if (debug) {
      console.log('[Observability] Web Vitals instrumentation active')
    }
  } catch {
    // web-vitals not available, skip silently
    if (debug) {
      console.log('[Observability] web-vitals not available, skipping')
    }
  }
}
