/**
 * React Integration
 *
 * React-specific observability utilities for component tracking.
 */

import type { ObservabilityInstance } from './types'

/**
 * Track a React component render duration.
 * Use in a useLayoutEffect or similar to measure render time.
 *
 * @example
 * ```tsx
 * const renderStart = useRef(performance.now())
 *
 * useLayoutEffect(() => {
 *   trackRender(observability, 'MyComponent', performance.now() - renderStart.current)
 * })
 * ```
 */
export function trackRender(
  observability: ObservabilityInstance,
  componentName: string,
  renderTime: number
): void {
  observability.trackMetric(`render.${componentName}`, renderTime, undefined, {
    component: componentName,
  })
}

/**
 * Track a React effect execution duration.
 * Use to measure how long useEffect/useLayoutEffect callbacks take.
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const start = performance.now()
 *   // ... effect logic
 *   trackEffect(observability, 'fetchUserData', performance.now() - start)
 * }, [])
 * ```
 */
export function trackEffect(
  observability: ObservabilityInstance,
  effectName: string,
  executionTime: number
): void {
  observability.trackMetric(`effect.${effectName}`, executionTime, undefined, {
    effect: effectName,
  })
}

/**
 * Create a higher-order function that wraps async operations with timing.
 *
 * @example
 * ```tsx
 * const trackedFetch = withTiming(observability, 'api.users', fetchUsers)
 * const users = await trackedFetch()
 * ```
 */
export function withTiming<TArgs extends unknown[], TResult>(
  observability: ObservabilityInstance,
  name: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const start = performance.now()
    try {
      const result = await fn(...args)
      observability.trackMetric(name, performance.now() - start, 'good', {
        success: true,
      })
      return result
    } catch (error) {
      observability.trackMetric(name, performance.now() - start, 'poor', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}
