import { useMemo, useRef, useEffect } from 'react';
import { addDays, format, startOfWeek, differenceInDays } from 'date-fns';

import { isIndependentEvent } from './calendar/utils';
import { CalendarHeader, DayColumn, IndependentEventsSection, TimeColumn } from './calendar';

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
  const daysContainerRef = useRef(null);

  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekEvents = useMemo(() => {
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), 'yyyy-MM-dd')
    );
    return events.filter((event) => weekDates.includes(event.start_date));
  }, [events, weekStart]);

  const allEventDates = useMemo(() => {
    return events.map((e) => e.start_date);
  }, [events]);

  const MIN_HOURS = 9;
  const { startHour, endHour } = useMemo(() => {
    const timedEvents = weekEvents.filter((event) => !isIndependentEvent(event));

    if (timedEvents.length === 0) {
      return { startHour: 8, endHour: 17 };
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

    let start = Math.max(0, minHour - 1);
    let end = Math.min(24, maxHour + 1);

    const currentHours = end - start;
    if (currentHours < MIN_HOURS) {
      const diff = MIN_HOURS - currentHours;
      const addBefore = Math.floor(diff / 2);
      const addAfter = diff - addBefore;
      start = Math.max(0, start - addBefore);
      end = Math.min(24, end + addAfter);
      if (end - start < MIN_HOURS) {
        if (start === 0) end = Math.min(24, MIN_HOURS);
        else start = Math.max(0, 24 - MIN_HOURS);
      }
    }

    return { startHour: start, endHour: end };
  }, [weekEvents]);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(hour);
    }
    return slots;
  }, [startHour, endHour]);

  const weekIndependentEvents = useMemo(() => {
    return weekEvents.filter((event) => isIndependentEvent(event));
  }, [weekEvents]);

  const timedEventsByDay = useMemo(() => {
    const grouped = {};
    weekDays.forEach((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      grouped[dayStr] = events.filter((e) => e.start_date === dayStr && !isIndependentEvent(e));
    });
    return grouped;
  }, [events, weekDays]);

  // Scroll to selected day on mobile when date changes
  useEffect(() => {
    const container = daysContainerRef.current;
    if (!container) return;

    // Only scroll on mobile (when horizontal scrolling is active)
    const isMobile = window.innerWidth < 640; // sm breakpoint
    if (!isMobile) return;

    // Calculate which day index to scroll to (0-6)
    const dayIndex = differenceInDays(selectedDate, weekStart);
    if (dayIndex < 0 || dayIndex > 6) return;

    // Find the day column element and scroll to it
    const dayColumns = container.children;
    if (dayColumns[dayIndex]) {
      dayColumns[dayIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      });
    }
  }, [selectedDate, weekStart]);

  return (
    <div className="flex w-full h-full flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white via-slate-50 to-slate-100 shadow-lg">
      <CalendarHeader
        selectedDate={selectedDate}
        weekStart={weekStart}
        shortId={shortId}
        onDateChange={onDateChange}
        eventDates={allEventDates}
      />

      <IndependentEventsSection events={weekIndependentEvents} />

      {/* Calendar grid container:
          - overflow-y-auto: vertical scroll for time slots
          - overflow-x-hidden: prevent parent from expanding horizontally
      */}
      <div className="flex flex-1 overflow-y-auto overflow-x-hidden">
        <TimeColumn timeSlots={timeSlots} timeFormat={timeFormat} />

        <div
          ref={daysContainerRef}
          className="flex w-0 min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth sm:w-auto sm:min-w-0 sm:snap-none sm:overflow-x-visible"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            return (
              <DayColumn
                key={dayStr}
                day={day}
                events={timedEventsByDay[dayStr] || []}
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
