import { formatTime, getEventColor, getEventStyle } from './utils';

/**
 * Single event card displayed on the calendar.
 * Shows event number for sequential ordering within the day.
 * Supports side-by-side layout for overlapping events via layoutInfo.
 */
export default function CalendarEvent({
  event,
  layoutInfo,
  startHour,
  timeFormat,
  eventNumber,
  totalEvents,
}) {
  const style = getEventStyle(event, startHour, layoutInfo);
  const colorClass = getEventColor(event);
  const hasValidTime = event.start && event.end && event.start !== event.end;

  // Show number badge when there are multiple events
  const showNumber = eventNumber && totalEvents > 1;

  return (
    <div
      className={`absolute overflow-hidden rounded-lg px-1.5 py-1 text-xs shadow-sm transition-shadow duration-200 hover:shadow-md ${colorClass}`}
      style={style}
      title={`${showNumber ? `#${eventNumber}: ` : ''}${event.title}\n${hasValidTime ? `${formatTime(event.start, timeFormat)} - ${formatTime(event.end, timeFormat)}\n` : ''}${event.location || ''}`}
    >
      {/* Event number badge - consistent sequential numbering */}
      {showNumber && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[9px] font-bold text-slate-600">
          {eventNumber}
        </span>
      )}

      <div className="leading-tight">
        {hasValidTime
          ? `${formatTime(event.start, timeFormat)} - ${formatTime(event.end, timeFormat)}`
          : ''}
      </div>
      <div className="mt-px truncate pr-4 leading-tight font-bold">{event.title}</div>
      {event.location && (
        <div className="mt-px truncate text-[11px] leading-tight text-slate-700 opacity-80">
          {event.location}
        </div>
      )}
    </div>
  );
}
