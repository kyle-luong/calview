import { EVENT_COLORS, EVENT_GAP, HOUR_HEIGHT } from './constants';

/**
 * Convert time string "HH:MM" to minutes from midnight
 */
export const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Check if an event is "independent" (no specific time slot).
 * Independent events have start === end, typically both at "12:00".
 * These should be displayed in a separate "Other" section, not in the hourly grid.
 */
export const isIndependentEvent = (event) => {
  if (!event.start || !event.end) return true;
  // Independent events have identical start and end times
  return event.start === event.end;
};

/**
 * Format hour for display (12h or 24h format)
 */
export const formatHour = (hour, timeFormat = '12h') => {
  if (timeFormat === '24h') {
    return `${hour}:00`;
  }
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12} ${suffix}`;
};

/**
 * Format time for event display
 */
export const formatTime = (time, timeFormat = '12h') => {
  if (timeFormat === '24h') return time;
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const hour12 = ((hour + 11) % 12) + 1;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`;
};

/**
 * Get consistent color for event based on title hash
 */
export const getEventColor = (event) => {
  const hash = event.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return EVENT_COLORS[hash % EVENT_COLORS.length];
};

/**
 * Determine column layout for overlapping events within a single day
 * Uses a greedy algorithm to assign columns to events that overlap
 */
export const calculateEventColumns = (dayEvents) => {
  if (!dayEvents || dayEvents.length === 0) {
    return [];
  }

  // Create items with timing info, sorted by start time
  const items = dayEvents.map((event, idx) => ({
    idx,
    start: timeToMinutes(event.start),
    end: timeToMinutes(event.end),
  }));

  // Sort by start time, then by end time
  const sorted = [...items].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.end - b.end;
  });

  // Track column assignments and when each column becomes free
  const layout = new Array(dayEvents.length).fill(null);
  const columnEnds = []; // columnEnds[i] = end time of event in column i

  sorted.forEach((item) => {
    // Find the first column that's free (ends before this event starts)
    let assignedColumn = -1;
    for (let col = 0; col < columnEnds.length; col++) {
      if (columnEnds[col] <= item.start) {
        assignedColumn = col;
        columnEnds[col] = item.end;
        break;
      }
    }

    // If no free column, create a new one
    if (assignedColumn === -1) {
      assignedColumn = columnEnds.length;
      columnEnds.push(item.end);
    }

    layout[item.idx] = { column: assignedColumn, totalColumns: 1 }; // totalColumns set later
  });

  // Now determine max overlapping columns for each event
  // For each event, find max concurrent events during its time span
  items.forEach((item) => {
    let maxConcurrent = 1;
    items.forEach((other) => {
      if (item.start < other.end && item.end > other.start) {
        // Count how many events overlap at the midpoint of item
        const midpoint = (item.start + item.end) / 2;
        let concurrentAtMid = 0;
        items.forEach((check) => {
          if (check.start <= midpoint && check.end > midpoint) {
            concurrentAtMid++;
          }
        });
        maxConcurrent = Math.max(maxConcurrent, concurrentAtMid);
      }
    });
    layout[item.idx].totalColumns = maxConcurrent;
  });

  return layout;
};

/**
 * Calculate event position, height, and column offsets
 */
export const getEventStyle = (event, startHour, layoutInfo = { column: 0, totalColumns: 1 }) => {
  const startMinutes = timeToMinutes(event.start);
  const endMinutes = timeToMinutes(event.end);
  const duration = endMinutes - startMinutes;

  // Grid starts at startHour
  const gridStartMinutes = startHour * 60;
  const topOffset = startMinutes - gridStartMinutes;

  // Each hour is HOUR_HEIGHT pixels tall
  const pixelsPerMinute = HOUR_HEIGHT / 60;
  const top = topOffset * pixelsPerMinute;
  const height = Math.max(duration * pixelsPerMinute, 30); // Min height 30px

  const { column = 0, totalColumns = 1 } = layoutInfo;

  if (totalColumns <= 1) {
    return {
      top: `${top}px`,
      height: `${height}px`,
      left: '0',
      width: '100%',
    };
  }

  // Calculate width and position so events sit side by side with minimal gap
  const gap = 2; // px gap between events
  const widthPercent = 100 / totalColumns;
  const leftPercent = widthPercent * column;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${widthPercent}% - ${gap}px)`,
    left: `calc(${leftPercent}%)`,
  };
};
