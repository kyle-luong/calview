import { useMemo } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';

import { isIndependentEvent } from './calendar/utils';
import { CalendarHeader, DayColumn, TimeColumn } from './calendar';

/**
 * Weekly calendar view similar to university schedule planners.
 * Shows a week with time slots on the left and days across the top.
 * Independent events (start=end) are shown in a separate "Other" section.
 */
export default function WeeklyCalendar({
  events = [],
  selectedDate = new Date(),
  onDateChange,
  timeFormat = '12h',
  shortId,
}) {
  // Get the start of the week (Sunday)
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);

  // Generate array of 7 days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Get events that fall within the current week
  const weekEvents = useMemo(() => {
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), 'yyyy-MM-dd')
    );
    return events.filter((event) => weekDates.includes(event.start_date));
  }, [events, weekStart]);

  // Also provide all event dates (from the full events prop) so date picker
  // can show markers for the entire ICS, not just this week.
  const allEventDates = useMemo(() => {
    return events.map((e) => e.start_date);
  }, [events]);

  // Calculate dynamic time range based on TIMED events only (exclude independent events).
  // Independent events (start=end=12:00) are shown in "Other" section,
  // so they shouldn't affect the time grid range.
  const MIN_HOURS = 9;

  const { startHour, endHour } = useMemo(() => {
    // Filter out independent events from time range calculation
    const timedEvents = weekEvents.filter((event) => !isIndependentEvent(event));

    if (timedEvents.length === 0) {
      return { startHour: 8, endHour: 17 }; // Default 8 AM - 5 PM (9 hours)
    }

    let minHour = 24;
    let maxHour = 0;

    timedEvents.forEach((event) => {
      const [startH] = event.start.split(':').map(Number);
      const [endH, endM] = event.end.split(':').map(Number);
      const actualEndHour = endM > 0 ? endH + 1 : endH;

      if (startH < minHour) minHour = startH;
      if (actualEndHour > maxHour) maxHour = actualEndHour;
    });

    // Add 1 hour padding before and after
    let start = Math.max(0, minHour - 1);
    let end = Math.min(24, maxHour + 1);

    // Ensure minimum hours displayed
    const currentHours = end - start;
    if (currentHours < MIN_HOURS) {
      const diff = MIN_HOURS - currentHours;
      const addBefore = Math.floor(diff / 2);
      const addAfter = diff - addBefore;
      start = Math.max(0, start - addBefore);
      end = Math.min(24, end + addAfter);
      // If we hit bounds, add remaining to other side
      if (end - start < MIN_HOURS) {
        if (start === 0) end = Math.min(24, MIN_HOURS);
        else start = Math.max(0, 24 - MIN_HOURS);
      }
    }

    return { startHour: start, endHour: end };
  }, [weekEvents]);

  // Time slots based on dynamic range
  const timeSlots = useMemo(() => {
    const slots = [];
    // Render slots from startHour (inclusive) to endHour (exclusive)
    // so the grid ends exactly at endHour without an extra margin row.
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(hour);
    }
    return slots;
  }, [startHour, endHour]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped = {};
    weekDays.forEach((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      grouped[dayStr] = events.filter((e) => e.start_date === dayStr);
    });
    return grouped;
  }, [events, weekDays]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white via-slate-50 to-slate-100 shadow-lg">
      <CalendarHeader
        selectedDate={selectedDate}
        weekStart={weekStart}
        shortId={shortId}
        onDateChange={onDateChange}
        eventDates={allEventDates}
      />

      {/* Calendar grid - scrollable, horizontal scroll with snap on mobile */}
      <div className="flex flex-1 overflow-auto sm:overflow-auto">
        <TimeColumn timeSlots={timeSlots} timeFormat={timeFormat} />

        {/* Days grid - horizontal scroll with snap on mobile */}
        <div
          className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth sm:snap-none sm:overflow-x-visible"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            return (
              <DayColumn
                key={dayStr}
                day={day}
                events={eventsByDay[dayStr] || []}
                timeSlots={timeSlots}
                startHour={startHour}
                endHour={endHour}
                timeFormat={timeFormat}
                selectedDate={selectedDate}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
