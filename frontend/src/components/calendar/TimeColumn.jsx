import { HOUR_HEIGHT } from './constants';
import { formatHour } from './utils';

/**
 * Left time column showing hour labels
 */
export default function TimeColumn({ timeSlots, timeFormat }) {
  return (
    <div className="sticky left-0 z-10 flex w-16 flex-shrink-0 flex-col border-r border-slate-200/70 bg-transparent backdrop-blur-sm">
      {/* FIX APPLIED: Added 'flex-none'. 
         This prevents the header from shrinking/growing, ensuring it matches the DayColumn header height exactly.
      */}
      <div className="sticky top-0 z-20 h-14 flex-none border-b border-slate-200 bg-slate-50" />

      {/* Time labels */}
      <div className="relative" style={{ height: `${timeSlots.length * HOUR_HEIGHT}px` }}>
        {timeSlots.map((hour) => (
          <div
            key={hour}
            style={{ height: `${HOUR_HEIGHT}px` }}
            className="flex items-start justify-end border-b border-slate-100 pt-1 pr-2 text-xs text-slate-500"
          >
            {formatHour(hour, timeFormat)}
          </div>
        ))}
      </div>
    </div>
  );
}
