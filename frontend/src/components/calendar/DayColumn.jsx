import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';

import CalendarEvent from './CalendarEvent';
import { HOUR_HEIGHT } from './constants';
import { calculateEventColumns } from './utils';

/**
 * Single day column showing the day header and timed events.
 * Independent/unscheduled events are shown in a separate top-level section.
 */
export default function DayColumn({ day, events, timeSlots, startHour, timeFormat, selectedDate }) {
  const isToday = isSameDay(day, new Date());
  const isSelected = isSameDay(day, selectedDate);

  // Sort events by start time for consistent display
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.start.localeCompare(b.start));
  }, [events]);

  // Calculate layout for overlapping events
  const dayLayouts = calculateEventColumns(sortedEvents);

  return (
    <div className="flex min-w-[85vw] flex-1 snap-start flex-col border-r border-slate-200 last:border-r-0 sm:min-w-[140px] sm:snap-align-none">
      {/* Day header - sticky */}
      <div
        className={`sticky top-0 z-10 flex h-14 flex-col items-center justify-center border-b border-slate-200 ${isToday ? 'bg-sky-100' : 'bg-white'
          }`}
      >
        <span className="text-xs font-medium text-slate-500 uppercase">{format(day, 'EEE')}</span>
        <span
          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'text-sky-600' : isSelected ? 'bg-slate-300 text-slate-900' : 'text-slate-900'
            }`}
        >
          {format(day, 'd')}
        </span>
      </div>

      {/* Time slots with timed events */}
      <div
        className={`relative ${isToday ? 'bg-slate-100/50' : ''}`}
        style={{ height: `${timeSlots.length * HOUR_HEIGHT}px` }}
      >
        {/* Grid lines */}
        {timeSlots.map((hour) => (
          <div
            key={hour}
            style={{ height: `${HOUR_HEIGHT}px` }}
            className={`border-b ${isToday ? 'border-slate-200 bg-sky-100/40' : 'border-slate-100'}`}
          />
        ))}

        {/* Timed events */}
        {sortedEvents.map((event, idx) => (
          <CalendarEvent
            key={`${event.title}-${idx}`}
            event={event}
            layoutInfo={dayLayouts[idx] || { column: 0, totalColumns: 1 }}
            startHour={startHour}
            timeFormat={timeFormat}
          />
        ))}
      </div>
    </div>
  );
}

