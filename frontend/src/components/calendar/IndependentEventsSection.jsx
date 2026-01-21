import { FiClock } from 'react-icons/fi';

/**
 * Top-level section showing all independent/unscheduled events for the week.
 * These are events with no specific time (e.g., independent study, async courses).
 */
export default function IndependentEventsSection({ events = [] }) {
    if (events.length === 0) return null;

    return (
        <div className="border-b border-dashed border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100/50 px-4 py-2">
            <div className="mb-2 flex items-center gap-2">
                <FiClock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Other / No Fixed Schedule
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {events.map((event, idx) => (
                    <div
                        key={`independent-${event.title}-${event.start_date}-${idx}`}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm transition-shadow hover:shadow-md"
                        title={`${event.title}${event.location ? `\nLocation: ${event.location}` : ''}${event.start_date ? `\nDate: ${event.start_date}` : ''}`}
                    >
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                        <span className="font-medium text-slate-700">{event.title}</span>
                        {event.location && (
                            <span className="text-slate-400">• {event.location}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
