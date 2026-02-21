import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createObservability } from './telemetry'
import { resetSessionCache } from './session'

describe('telemetry', () => {
  beforeEach(() => {
    resetSessionCache()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('createObservability', () => {
    it('creates an observability instance with default config', () => {
      const obs = createObservability()
      expect(obs).toBeDefined()
      expect(obs.trackEvent).toBeTypeOf('function')
      expect(obs.trackMetric).toBeTypeOf('function')
      expect(obs.trackError).toBeTypeOf('function')
      expect(obs.trackTrace).toBeTypeOf('function')
      expect(obs.captureException).toBeTypeOf('function')
      expect(obs.trackPageView).toBeTypeOf('function')
      expect(obs.flush).toBeTypeOf('function')
      expect(obs.cleanup).toBeTypeOf('function')
      expect(obs.getSessionId).toBeTypeOf('function')
      obs.cleanup()
    })

    it('accepts custom configuration', () => {
      const obs = createObservability({
        telemetryEndpoint: '/custom/endpoint',
        batchSize: 5,
        flushInterval: 1000,
        debug: false,
      })
      expect(obs).toBeDefined()
      obs.cleanup()
    })

    it('uses custom session ID provider', () => {
      const customProvider = vi.fn().mockReturnValue('custom-session-123')
      const obs = createObservability({
        sessionIdProvider: customProvider,
      })
      expect(obs.getSessionId()).toBe('custom-session-123')
      expect(customProvider).toHaveBeenCalled()
      obs.cleanup()
    })
  })

  describe('trackEvent', () => {
    it('collects events in the queue', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({
        batchSize: 1,
        debug: false,
      })

      obs.trackEvent('test_event', { foo: 'bar' })

      // Flush should be scheduled
      vi.advanceTimersByTime(100)

      // Wait for the flush to complete
      await vi.runAllTimersAsync()

      expect(fetchSpy).toHaveBeenCalled()
      obs.cleanup()
    })

    it('batches events before sending', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({
        batchSize: 3,
        flushInterval: 10000,
        debug: false,
      })

      obs.trackEvent('event1')
      obs.trackEvent('event2')

      // Not enough events yet
      vi.advanceTimersByTime(100)
      expect(fetchSpy).not.toHaveBeenCalled()

      obs.trackEvent('event3')

      // Now we hit batch size
      await vi.runAllTimersAsync()
      expect(fetchSpy).toHaveBeenCalled()

      obs.cleanup()
    })
  })

  describe('trackMetric', () => {
    it('tracks metrics with value and rating', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 1 })
      obs.trackMetric('test_metric', 100, 'good', { extra: 'data' })

      await vi.runAllTimersAsync()

      expect(fetchSpy).toHaveBeenCalled()
      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
      expect(body.events[0].type).toBe('metric')
      expect(body.events[0].name).toBe('test_metric')
      expect(body.events[0].value).toBe(100)
      expect(body.events[0].rating).toBe('good')

      obs.cleanup()
    })
  })

  describe('trackError', () => {
    it('tracks errors with message and stack', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 1 })
      const error = new Error('Test error')
      obs.trackError('test_error', error, { context: 'test' })

      await vi.runAllTimersAsync()

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
      expect(body.events[0].type).toBe('error')
      expect(body.events[0].properties.message).toBe('Test error')
      expect(body.events[0].properties.stack).toBeDefined()

      obs.cleanup()
    })

    it('handles non-Error objects', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 1 })
      obs.trackError('test_error', 'string error')

      await vi.runAllTimersAsync()

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
      expect(body.events[0].properties.message).toBe('string error')

      obs.cleanup()
    })
  })

  describe('captureException', () => {
    it('logs error to console and tracks it', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 1 })
      const error = new Error('Exception')
      obs.captureException(error, { component: 'TestComponent' })

      await vi.runAllTimersAsync()

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Observability] Exception captured:', error)
      expect(fetchSpy).toHaveBeenCalled()

      obs.cleanup()
    })
  })

  describe('trackPageView', () => {
    it('tracks page view as an event', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 1 })
      obs.trackPageView('/test-page', { referrer: '/home' })

      await vi.runAllTimersAsync()

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
      expect(body.events[0].name).toBe('page_view')
      expect(body.events[0].properties.path).toBe('/test-page')
      expect(body.events[0].properties.referrer).toBe('/home')

      obs.cleanup()
    })
  })

  describe('flush', () => {
    it('triggers immediate flush', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 100, flushInterval: 60000 })
      obs.trackEvent('test')
      obs.flush()

      await vi.runAllTimersAsync()

      expect(fetchSpy).toHaveBeenCalled()
      obs.cleanup()
    })
  })

  describe('cleanup', () => {
    it('removes event listeners and clears timers', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const obs = createObservability()
      obs.cleanup()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      )
    })
  })

  describe('error handling', () => {
    it('logs warning on fetch failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const obs = createObservability({ batchSize: 1, debug: false })
      obs.trackEvent('test')

      // Advance enough for the initial flush (requestIdleCallback fallback = setTimeout 0)
      await vi.advanceTimersByTimeAsync(100)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Observability] Telemetry send failed'),
        'Network error'
      )

      obs.cleanup()
    })

    it('applies exponential backoff on consecutive failures', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const obs = createObservability({ batchSize: 1, flushInterval: 1000, debug: false })

      // First event triggers first flush attempt
      obs.trackEvent('test1')
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // During backoff (5s), new events should NOT trigger a flush
      obs.trackEvent('test2')
      await vi.advanceTimersByTimeAsync(1000)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance past the 5s backoff — retry fires
      await vi.advanceTimersByTimeAsync(5000)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      obs.cleanup()
    })

    it('recovers after successful send', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(new Response())

      const obs = createObservability({ batchSize: 1, debug: false })
      obs.trackEvent('fail_event')

      // First flush fails
      await vi.advanceTimersByTimeAsync(100)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // Advance past 5s backoff — retry succeeds
      await vi.advanceTimersByTimeAsync(6000)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      obs.cleanup()
    })

    it('suppresses duplicate error logs within 60s', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      const obs = createObservability({ batchSize: 1, debug: false })

      // First failure logs
      obs.trackEvent('test1')
      await vi.advanceTimersByTimeAsync(100)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)

      // Advance past 5s backoff — second failure should NOT log (within 60s window)
      await vi.advanceTimersByTimeAsync(6000)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1)

      obs.cleanup()
    })
  })
})
