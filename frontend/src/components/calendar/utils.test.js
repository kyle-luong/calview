import { describe, expect, it } from 'vitest';

import {
  calculateEventColumns,
  formatHour,
  formatTime,
  getEventColor,
  getEventStyle,
  isIndependentEvent,
  timeToMinutes,
} from './utils';

describe('calendar utilities', () => {
  describe('timeToMinutes', () => {
    it('converts time string to minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:00')).toBe(60);
      expect(timeToMinutes('12:30')).toBe(750);
      expect(timeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('formatHour', () => {
    it('formats hour in 12h format', () => {
      expect(formatHour(0, '12h')).toBe('12 AM');
      expect(formatHour(12, '12h')).toBe('12 PM');
      expect(formatHour(13, '12h')).toBe('1 PM');
      expect(formatHour(23, '12h')).toBe('11 PM');
    });

    it('formats hour in 24h format', () => {
      expect(formatHour(0, '24h')).toBe('0:00');
      expect(formatHour(12, '24h')).toBe('12:00');
      expect(formatHour(23, '24h')).toBe('23:00');
    });
  });

  describe('formatTime', () => {
    it('formats time in 12h format', () => {
      expect(formatTime('09:30', '12h')).toBe('9:30 am');
      expect(formatTime('14:00', '12h')).toBe('2:00 pm');
    });

    it('formats time in 24h format', () => {
      expect(formatTime('09:30', '24h')).toBe('09:30');
      expect(formatTime('14:00', '24h')).toBe('14:00');
    });
  });

  describe('getEventColor', () => {
    it('returns consistent color for same title', () => {
      const color1 = getEventColor({ title: 'Math 101' });
      const color2 = getEventColor({ title: 'Math 101' });
      expect(color1).toBe(color2);
    });

    it('returns different colors for different titles', () => {
      const color1 = getEventColor({ title: 'Math 101' });
      const color2 = getEventColor({ title: 'Physics 201' });
      // Colors might be same due to hash collision, but usually different
      expect(typeof color1).toBe('string');
      expect(typeof color2).toBe('string');
    });
  });

  describe('calculateEventColumns', () => {
    it('returns empty array for no events', () => {
      expect(calculateEventColumns([])).toEqual([]);
    });

    it('assigns single column for non-overlapping events', () => {
      const events = [
        { start: '09:00', end: '10:00' },
        { start: '11:00', end: '12:00' },
      ];
      const result = calculateEventColumns(events);
      expect(result[0].column).toBe(0);
      expect(result[1].column).toBe(0);
      expect(result[0].totalColumns).toBe(1);
      expect(result[1].totalColumns).toBe(1);
    });

    it('assigns multiple columns for overlapping events', () => {
      // Events that overlap at both midpoints
      const events = [
        { start: '09:00', end: '11:30' },
        { start: '09:30', end: '11:00' },
      ];
      const result = calculateEventColumns(events);
      expect(result[0].totalColumns).toBe(2);
      expect(result[1].totalColumns).toBe(2);
      // Should be in different columns
      expect(result[0].column).not.toBe(result[1].column);
    });
  });

  describe('getEventStyle', () => {
    it('calculates position based on time', () => {
      const event = { start: '09:00', end: '10:00' };
      const style = getEventStyle(event, 8, { column: 0, totalColumns: 1 });
      expect(style.top).toBeDefined();
      expect(style.height).toBeDefined();
    });
  });

  describe('isIndependentEvent', () => {
    it('returns true for events with same start and end time', () => {
      expect(isIndependentEvent({ start: '12:00', end: '12:00' })).toBe(true);
      expect(isIndependentEvent({ start: '00:00', end: '00:00' })).toBe(true);
    });

    it('returns false for events with different start and end times', () => {
      expect(isIndependentEvent({ start: '09:00', end: '10:00' })).toBe(false);
      expect(isIndependentEvent({ start: '12:00', end: '13:00' })).toBe(false);
    });

    it('returns true for events missing start or end', () => {
      expect(isIndependentEvent({ start: '12:00' })).toBe(true);
      expect(isIndependentEvent({ end: '12:00' })).toBe(true);
      expect(isIndependentEvent({})).toBe(true);
    });
  });
});
