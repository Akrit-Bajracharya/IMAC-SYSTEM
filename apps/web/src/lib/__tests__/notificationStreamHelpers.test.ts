/**
 * Table-driven unit tests for notificationStreamHelpers (Step 18a).
 *
 * NOTE: Vitest runs in Node.js here and does NOT run browser EventSource
 * or render React components. These tests verify pure backoff, event parsing,
 * fallback polling, and tab-visibility decision logic.
 */

import { describe, it, expect } from 'vitest';
import {
  getStreamBackoffDelayMs,
  parseNotificationStreamEvent,
  getUnreadFallbackRefetchInterval,
  decideStreamActionOnVisibility,
  HIDDEN_TAB_CLOSE_DELAY_MS,
  FALLBACK_POLL_INTERVAL_MS,
} from '../notificationStreamHelpers.js';

describe('notificationStreamHelpers', () => {
  describe('getStreamBackoffDelayMs', () => {
    it.each([
      { attempt: -1, expected: 5000 },
      { attempt: 0, expected: 5000 },
      { attempt: 1, expected: 10000 },
      { attempt: 2, expected: 20000 },
      { attempt: 3, expected: 40000 },
      { attempt: 4, expected: 60000 },
      { attempt: 10, expected: 60000 },
      { attempt: 100, expected: 60000 },
    ])('attempt $attempt -> $expected ms', ({ attempt, expected }) => {
      expect(getStreamBackoffDelayMs(attempt)).toBe(expected);
    });
  });

  describe('parseNotificationStreamEvent', () => {
    it.each([
      {
        name: 'valid event with unreadCount only',
        raw: '{"unreadCount":3}',
        expected: { unreadCount: 3 },
      },
      {
        name: 'valid event with unreadCount: 0 and notificationId',
        raw: '{"unreadCount":0,"notificationId":"notif-123"}',
        expected: { unreadCount: 0, notificationId: 'notif-123' },
      },
      {
        name: 'ignores extra/unknown keys',
        raw: '{"unreadCount":5,"extra":"ignored","title":"bad"}',
        expected: { unreadCount: 5 },
      },
      {
        name: 'returns null for empty string',
        raw: '   ',
        expected: null,
      },
      {
        name: 'returns null for non-string input',
        raw: null,
        expected: null,
      },
      {
        name: 'returns null for malformed JSON',
        raw: '{broken json',
        expected: null,
      },
      {
        name: 'returns null for JSON array',
        raw: '[1,2,3]',
        expected: null,
      },
      {
        name: 'returns null for negative unreadCount',
        raw: '{"unreadCount":-1}',
        expected: null,
      },
      {
        name: 'returns null for non-integer unreadCount',
        raw: '{"unreadCount":1.5}',
        expected: null,
      },
      {
        name: 'returns null for string unreadCount',
        raw: '{"unreadCount":"3"}',
        expected: null,
      },
      {
        name: 'returns null when unreadCount is missing',
        raw: '{"notificationId":"notif-1"}',
        expected: null,
      },
    ])('$name', ({ raw, expected }) => {
      expect(parseNotificationStreamEvent(raw)).toEqual(expected);
    });
  });

  describe('getUnreadFallbackRefetchInterval', () => {
    it('returns false when stream is connected and 60000ms when disconnected', () => {
      expect(getUnreadFallbackRefetchInterval(true)).toBe(false);
      expect(getUnreadFallbackRefetchInterval(false)).toBe(FALLBACK_POLL_INTERVAL_MS);
    });
  });

  describe('decideStreamActionOnVisibility (Amendment G)', () => {
    it('cancels pending close timer and stays idle when tab becomes visible and stream is already open', () => {
      expect(
        decideStreamActionOnVisibility({ isVisible: true, isStreamOpen: true })
      ).toEqual({
        cancelPendingClose: true,
        action: 'none',
      });
    });

    it('cancels pending close timer and reconnects when tab becomes visible and stream is closed', () => {
      expect(
        decideStreamActionOnVisibility({ isVisible: true, isStreamOpen: false })
      ).toEqual({
        cancelPendingClose: true,
        action: 'reconnect_now',
      });
    });

    it('schedules 2-minute close when tab becomes hidden and stream is open', () => {
      expect(
        decideStreamActionOnVisibility({ isVisible: false, isStreamOpen: true })
      ).toEqual({
        cancelPendingClose: false,
        action: 'schedule_close',
        delayMs: HIDDEN_TAB_CLOSE_DELAY_MS,
      });
    });

    it('does nothing when tab becomes hidden and stream is already closed', () => {
      expect(
        decideStreamActionOnVisibility({ isVisible: false, isStreamOpen: false })
      ).toEqual({
        cancelPendingClose: false,
        action: 'none',
        delayMs: HIDDEN_TAB_CLOSE_DELAY_MS,
      });
    });
  });
});
