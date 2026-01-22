import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { FaBicycle, FaCar, FaWalking } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import 'react-day-picker/dist/style.css';

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
 * Shared DatePicker Popup
 * Renders the floating calendar
 */
const DatePickerPopup = ({ selectedDate, onSelect, eventDateStrings }) => (
  <div className="absolute top-[45px] left-0 z-50 rounded-lg border border-slate-200 bg-white p-4 shadow-md">
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
    />
  </div>
);

/**
 * Desktop Controls (Visible on sm+)
 * Layout: Single row, justified between
 */
const DesktopControls = ({
  selectedDate,
  setSelectedDate,
  timeFormat,
  setTimeFormat,
  transportMode,
  setTransportMode,
  showCalendar,
  setShowCalendar,
  eventDateStrings,
}) => {
  return (
    <div className="hidden w-full items-center justify-between gap-4 sm:flex relative">
      {/* Date Navigation */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="rounded-md bg-slate-200 px-2 py-1 text-sm hover:bg-slate-300"
        >
          <FiChevronLeft className="text-sky-600" />
        </button>
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          {format(selectedDate, 'EEE MMM d')}
        </button>
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="rounded-md bg-slate-200 px-2 py-1 text-sm hover:bg-slate-300"
        >
          <FiChevronRight className="text-sky-600" />
        </button>
      </div>

      {/* Settings (Transport + Time) */}
      <div className="flex space-x-3">
        <div className="flex space-x-2 rounded-md bg-slate-100 px-2 py-1">
          {[
            ['walking', <FaWalking key="walk" />],
            ['cycling', <FaBicycle key="bike" />],
            ['driving', <FaCar key="car" />],
          ].map(([mode, icon]) => (
            <button
              key={mode}
              onClick={() => setTransportMode(mode)}
              className={`text-base ${transportMode === mode ? 'text-sky-600' : 'text-slate-500'}`}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex space-x-1 rounded-md bg-slate-100 px-2 py-1">
          {['12h', '24h'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setTimeFormat(fmt)}
              className={`px-1 text-sm ${timeFormat === fmt ? 'text-sky-600' : 'text-slate-500'}`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Popup */}
      {showCalendar && (
        <DatePickerPopup
          selectedDate={selectedDate}
          onSelect={(date) => {
            if (date) {
              setSelectedDate(date);
              setShowCalendar(false);
            }
          }}
          eventDateStrings={eventDateStrings}
        />
      )}
    </div>
  );
};

/**
 * Mobile Controls (Visible on < sm)
 * Layout: Flex wrap (or stacked if you change the classes later)
 */
const MobileControls = ({
  selectedDate,
  setSelectedDate,
  timeFormat,
  setTimeFormat,
  transportMode,
  setTransportMode,
  showCalendar,
  setShowCalendar,
  eventDateStrings,
}) => {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:hidden relative">
      {/* Date Navigation */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="rounded-md bg-slate-200 px-1 py-1 text-sm hover:bg-slate-300"
        >
          <FiChevronLeft className="text-sky-600" />
        </button>
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="rounded-md bg-slate-100 px-1 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          {format(selectedDate, 'EEE MMM d')}
        </button>
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="rounded-md bg-slate-200 px-1 py-1 text-sm hover:bg-slate-300"
        >
          <FiChevronRight className="text-sky-600" />
        </button>
      </div>

      {/* Settings Grouped together for mobile */}
      <div className="flex space-x-2">
        <div className="flex space-x-1 rounded-md bg-slate-100 px-2 py-1">
          {[
            ['walking', <FaWalking key="walk" />],
            ['cycling', <FaBicycle key="bike" />],
            ['driving', <FaCar key="car" />],
          ].map(([mode, icon]) => (
            <button
              key={mode}
              onClick={() => setTransportMode(mode)}
              className={`text-base ${transportMode === mode ? 'text-sky-600' : 'text-slate-500'}`}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex space-x-1 rounded-md bg-slate-100 px-2 py-1">
          {['12h', '24h'].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setTimeFormat(fmt)}
              className={`px-1 text-sm ${timeFormat === fmt ? 'text-sky-600' : 'text-slate-500'}`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Popup */}
      {showCalendar && (
        <DatePickerPopup
          selectedDate={selectedDate}
          onSelect={(date) => {
            if (date) {
              setSelectedDate(date);
              setShowCalendar(false);
            }
          }}
          eventDateStrings={eventDateStrings}
        />
      )}
    </div>
  );
};

export default function ScheduleHeader({
  selectedDate,
  setSelectedDate,
  timeFormat,
  setTimeFormat,
  transportMode,
  setTransportMode,
  eventDates = [],
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const eventDateStrings = eventDates.map((d) => parseISO(d).toDateString());

  // Helper props object to pass to both components
  const commonProps = {
    selectedDate,
    setSelectedDate,
    timeFormat,
    setTimeFormat,
    transportMode,
    setTransportMode,
    showCalendar,
    setShowCalendar,
    eventDateStrings,
  };

  return (
    <div className="relative z-10 w-full">
      <style>{calendarStyles}</style>

      {/* 1. Desktop View */}
      <DesktopControls {...commonProps} />

      {/* 2. Mobile View */}
      <MobileControls {...commonProps} />
    </div>
  );
}