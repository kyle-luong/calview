import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import 'react-day-picker/dist/style.css';
import ShareableLink from '../ShareableLink';
import ShareableLinkMobile from '../ShareableLinkMobile';

const calendarStyles = `
  .selected-day {
    background-color: #0ea5e9 !important;
    color: white !important;
    font-weight: bold;
  }
  .selected-day:hover {
    background-color: #0284c7 !important;
  }
  .today-day {
    background-color: #f1f5f9;
    font-weight: bold;
  }
  .has-events {
    position: relative;
  }
  .has-events::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    background-color: #0ea5e9;
    border-radius: 50%;
  }
`;

/**
 * Shared DatePicker Popup Component
 */
const DatePickerPopup = ({ selectedDate, onSelect, eventDateStrings }) => (
  <div className="absolute top-[40px] left-0 z-[120] rounded-lg border border-slate-200 bg-white p-4 shadow-md">
    <DayPicker
      mode="single"
      selected={selectedDate}
      onSelect={onSelect}
      showOutsideDays
      weekStartsOn={0}
      modifiers={{
        hasEvents: (day) => eventDateStrings.includes(day.toDateString()),
      }}
      modifiersClassNames={{
        hasEvents: 'has-events',
        selected: 'selected-day',
        today: 'today-day',
      }}
      components={{
        PreviousMonthButton: (props) => (
          <button {...props} className="rounded-md p-1 hover:bg-slate-200">
            <FiChevronLeft className="text-xl text-sky-600" />
          </button>
        ),
        NextMonthButton: (props) => (
          <button {...props} className="rounded-md p-1 hover:bg-slate-200">
            <FiChevronRight className="text-xl text-sky-600" />
          </button>
        ),
      }}
      className="text-sm"
    />
  </div>
);

/**
 * Desktop Navigation (Visible on sm+)
 * Represents the ENTIRE header row for desktop
 */
const DesktopNavigation = ({ 
  onPrev, 
  onNext, 
  onToday, 
  onTogglePicker, 
  showPicker, 
  selectedDate, 
  onDateSelect, 
  eventDateStrings,
  weekStart, // Added prop
  shortId    // Added prop
}) => {
  return (
    // Added 'w-full justify-between' so elements spread out correctly
    <div className="hidden w-full items-center justify-between sm:flex relative">
      <div className="flex items-center">
        <button
          onClick={onPrev}
          className="rounded-lg p-2 text-slate-400 hover:text-sky-600"
          aria-label="Previous week"
        >
          <FiChevronLeft className="h-7 w-7" />
        </button>
        <button
          onClick={onNext}
          className="rounded-lg p-2 text-slate-400 hover:text-sky-600"
          aria-label="Next week"
        >
          <FiChevronRight className="h-7 w-7" />
        </button>
        <button
          onClick={onToday}
          className="mx-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-sky-600"
        >
          Today
        </button>
        <button
          onClick={onTogglePicker}
          className="ml-2 rounded-lg border border-slate-300 p-2 text-sm text-slate-500 hover:text-sky-600"
          title="Pick a date"
        >
          <FiCalendar className="h-4 w-4" />
        </button>

        {showPicker && (
          <DatePickerPopup 
            selectedDate={selectedDate} 
            onSelect={onDateSelect} 
            eventDateStrings={eventDateStrings} 
          />
        )}
      </div>

      {/* Center: Month Year */}
      <h2 className="text-xl font-semibold text-slate-800">{format(weekStart, 'MMMM yyyy')}</h2>

      {/* Right: Share Link */}
      <div className="flex items-center">{shortId && <ShareableLink shortId={shortId} />}</div>
    </div>
  );
};

/**
 * Mobile Navigation (Visible on < sm)
 * Represents the ENTIRE header row for mobile
 */
const MobileNavigation = ({ 
  onToday, 
  onTogglePicker, 
  showPicker, 
  selectedDate, 
  onDateSelect, 
  eventDateStrings,
  weekStart, // Added prop
  shortId    // Added prop
}) => {
  return (
    // Added 'w-full justify-between' so elements spread out correctly
    <div className="flex w-full items-center justify-between sm:hidden relative">
      <div className="flex items-center">
        <button
          onClick={onToday}
          className="mx-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-sky-600"
        >
          Today
        </button>
        <button
          onClick={onTogglePicker}
          className="ml-2 rounded-lg border border-slate-300 p-2 text-sm text-slate-500 hover:text-sky-600"
          title="Pick a date"
        >
          <FiCalendar className="h-4 w-4" />
        </button>

        {showPicker && (
          <DatePickerPopup 
            selectedDate={selectedDate} 
            onSelect={onDateSelect} 
            eventDateStrings={eventDateStrings} 
          />
        )}
      </div>

      {/* Center: Month Year (Smaller text for mobile) */}
      <h2 className="px-4 text-base font-semibold text-slate-800">{format(weekStart, 'MMMM yyyy')}</h2>

      {/* Right: Share Link Mobile */}
      <div className="flex items-center">{shortId && <ShareableLinkMobile shortId={shortId} />}</div>
    </div>
  );
};

/**
 * Main Calendar Header
 */
export default function CalendarHeader({
  selectedDate,
  weekStart,
  shortId,
  onDateChange,
  eventDates = [],
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const goToPrevWeek = () => onDateChange?.(addDays(selectedDate, -7));
  const goToNextWeek = () => onDateChange?.(addDays(selectedDate, 7));
  const goToToday = () => onDateChange?.(new Date());
  
  const handleDateSelect = (date) => {
    if (date) {
      onDateChange?.(date);
      setShowDatePicker(false);
    }
  };

  const eventDateStrings = (eventDates || []).map((d) => parseISO(d).toDateString());

  return (
    <div className="relative z-20 flex items-center border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm">
      <style>{calendarStyles}</style>
      
      {/* 1. Desktop View */}
      <DesktopNavigation 
        onPrev={goToPrevWeek}
        onNext={goToNextWeek}
        onToday={goToToday}
        onTogglePicker={() => setShowDatePicker(!showDatePicker)}
        showPicker={showDatePicker}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        eventDateStrings={eventDateStrings}
        weekStart={weekStart} // Passed prop
        shortId={shortId}     // Passed prop
      />

      {/* 2. Mobile View */}
      <MobileNavigation 
        onToday={goToToday}
        onTogglePicker={() => setShowDatePicker(!showDatePicker)}
        showPicker={showDatePicker}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        eventDateStrings={eventDateStrings}
        weekStart={weekStart} // Passed prop
        shortId={shortId}     // Passed prop
      />

    </div>
  );
}