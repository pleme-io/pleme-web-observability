import { describe, it, expect, vi } from 'vitest'
import { trackRender, trackEffect, withTiming } from './react'
import type { ObservabilityInstance } from './types'

describe('react', () => {
  const createMockObservability = (): ObservabilityInstance => ({
    trackMetric: vi.fn(),
    trackEvent: vi.fn(),
    trackError: vi.fn(),
    trackTrace: vi.fn(),
    captureException: vi.fn(),
    trackPageView: vi.fn(),
    flush: vi.fn(),
    cleanup: vi.fn(),
    getSessionId: vi.fn().mockReturnValue('test-session'),
  })

  describe('trackRender', () => {
    it('tracks component render time', () => {
      const obs = createMockObservability()
      trackRender(obs, 'MyComponent', 15.5)

      expect(obs.trackMetric).toHaveBeenCalledWith(
        'render.MyComponent',
        15.5,
        undefined,
        { component: 'MyComponent' }
      )
    })
  })

  describe('trackEffect', () => {
    it('tracks effect execution time', () => {
      const obs = createMockObservability()
      trackEffect(obs, 'fetchData', 100)

      expect(obs.trackMetric).toHaveBeenCalledWith(
        'effect.fetchData',
        100,
        undefined,
        { effect: 'fetchData' }
      )
    })
  })

  describe('withTiming', () => {
    it('wraps async function with timing', async () => {
      const obs = createMockObservability()
      const mockFn = vi.fn().mockResolvedValue('result')

      const wrapped = withTiming(obs, 'api.test', mockFn)
      const result = await wrapped('arg1', 'arg2')

      expect(result).toBe('result')
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
      expect(obs.trackMetric).toHaveBeenCalledWith(
        'api.test',
        expect.any(Number),
        'good',
        { success: true }
      )
    })

    it('tracks errors in wrapped functions', async () => {
      const obs = createMockObservability()
      const error = new Error('Test error')
      const mockFn = vi.fn().mockRejectedValue(error)

      const wrapped = withTiming(obs, 'api.test', mockFn)

      await expect(wrapped()).rejects.toThrow('Test error')
      expect(obs.trackMetric).toHaveBeenCalledWith(
        'api.test',
        expect.any(Number),
        'poor',
        { success: false, error: 'Test error' }
      )
    })

    it('preserves function arguments and return type', async () => {
      const obs = createMockObservability()
      const mockFn = vi.fn(async (a: number, b: string) => ({ sum: a, str: b }))

      const wrapped = withTiming(obs, 'complex.fn', mockFn)
      const result = await wrapped(42, 'hello')

      expect(result).toEqual({ sum: 42, str: 'hello' })
      expect(mockFn).toHaveBeenCalledWith(42, 'hello')
    })
  })
})
