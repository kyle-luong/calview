import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';

import CalendarEvent from './CalendarEvent';
import { HOUR_HEIGHT } from './constants';
import { calculateEventColumns, isIndependentEvent } from './utils';

/**
 * Single day column showing the day header and events
 * Separates "independent" events (start=end=12:00) into an "Other" section
 */
export default function DayColumn({ day, events, timeSlots, startHour, timeFormat, selectedDate }) {
  const isToday = isSameDay(day, new Date());
  const isSelected = isSameDay(day, selectedDate);

  // Separate independent events (start=end, typically 12:00) from timed events
  const { timedEvents, independentEvents } = useMemo(() => {
    const timed = [];
    const independent = [];

    events.forEach((event) => {
      if (isIndependentEvent(event)) {
        independent.push(event);
      } else {
        timed.push(event);
      }
    });

    // Sort timed events by start time for consistent numbering
    timed.sort((a, b) => a.start.localeCompare(b.start));

    return { timedEvents: timed, independentEvents: independent };
  }, [events]);

  // Calculate layout only for timed events (overlapping handling)
  const dayLayouts = calculateEventColumns(timedEvents);

  return (
    <div className="flex min-w-[85vw] flex-1 snap-start flex-col border-r border-slate-200 last:border-r-0 sm:min-w-[140px] sm:snap-align-none">
      {/* Day header - sticky */}
      <div
        className={`sticky top-0 z-10 flex h-14 flex-col items-center justify-center border-b border-slate-200 ${
          isToday ? 'bg-sky-100' : 'bg-white'
        }`}
      >
        <span className="text-xs font-medium text-slate-500 uppercase">{format(day, 'EEE')}</span>
        <span
          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
            isToday ? 'text-sky-600' : isSelected ? 'bg-slate-300 text-slate-900' : 'text-slate-900'
          }`}
        >
          {format(day, 'd')}
        </span>
      </div>

      {/* "Other" section for independent events (no specific time) */}
      {independentEvents.length > 0 && (
        <div className="border-b border-dashed border-slate-300 bg-slate-50 px-1 py-1.5">
          <div className="mb-1 text-center text-[10px] font-medium tracking-wide text-slate-400 uppercase">
            Other
          </div>
          {independentEvents.map((event, idx) => (
            <div
              key={`independent-${event.title}-${idx}`}
              className="mb-1 truncate rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-600"
              title={`${event.title}${event.location ? `\n${event.location}` : ''}`}
            >
              {event.title}
            </div>
          ))}
        </div>
      )}

      {/* Time slots with timed events - explicit height to prevent offset */}
      <div
        className={`relative ${isToday ? 'bg-slate-100/50' : ''}`}
        style={{ height: `${timeSlots.length * HOUR_HEIGHT}px` }}
      >
        {/* Grid lines */}
        {timeSlots.map((hour) => (
          <div
            key={hour}
            style={{ height: `${HOUR_HEIGHT}px` }}
            className={`border-b ${isToday ? 'border-slate-200 bg-sky-200/70' : 'border-slate-100'}`}
          />
        ))}

        {/* Timed events with sequential numbering */}
        {timedEvents.map((event, idx) => (
          <CalendarEvent
            key={`${event.title}-${idx}`}
            event={event}
            layoutInfo={dayLayouts[idx] || { column: 0, totalColumns: 1 }}
            startHour={startHour}
            timeFormat={timeFormat}
            eventNumber={idx + 1}
            totalEvents={timedEvents.length}
          />
        ))}
      </div>
    </div>
  );
}
