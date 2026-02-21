import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSessionId, getCurrentPage, isDevelopment, resetSessionCache } from './session'

describe('session', () => {
  beforeEach(() => {
    resetSessionCache()
    sessionStorage.clear()
  })

  describe('getSessionId', () => {
    it('generates a new session ID if none exists', () => {
      const sessionId = getSessionId('test_session')
      expect(sessionId).toMatch(/^\d+-[a-z0-9]+$/)
    })

    it('returns cached session ID on subsequent calls', () => {
      const sessionId1 = getSessionId('test_session')
      const sessionId2 = getSessionId('test_session')
      expect(sessionId1).toBe(sessionId2)
    })

    it('stores session ID in sessionStorage', () => {
      const sessionId = getSessionId('test_session')
      expect(sessionStorage.getItem('test_session')).toBe(sessionId)
    })

    it('retrieves existing session ID from sessionStorage', () => {
      sessionStorage.setItem('test_session', 'existing-session-123')
      const sessionId = getSessionId('test_session')
      expect(sessionId).toBe('existing-session-123')
    })

    it('uses different keys for different sessions', () => {
      const sessionId1 = getSessionId('session_a')
      resetSessionCache()
      const sessionId2 = getSessionId('session_b')
      expect(sessionId1).not.toBe(sessionId2)
    })
  })

  describe('getCurrentPage', () => {
    it('returns the current pathname', () => {
      const page = getCurrentPage()
      expect(page).toBe('/')
    })
  })

  describe('isDevelopment', () => {
    it('returns true for localhost', () => {
      // jsdom defaults to localhost
      expect(isDevelopment()).toBe(true)
    })
  })

  describe('resetSessionCache', () => {
    it('clears the cached session ID', () => {
      const sessionId1 = getSessionId('test_session')
      resetSessionCache()
      sessionStorage.removeItem('test_session')
      const sessionId2 = getSessionId('test_session')
      expect(sessionId1).not.toBe(sessionId2)
    })
  })
})
