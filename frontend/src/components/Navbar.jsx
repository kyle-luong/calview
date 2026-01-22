import { FiCalendar, FiMap } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import { getSession } from '../lib/session';

/**
 * Desktop Navbar (Visible on sm+)
 * Features: Larger text, full button labels, wider spacing
 */
const DesktopNavbar = ({ activeSession, isOnMapView, isOnCalendarView, pathname }) => {
  return (
    <div className="hidden h-14 w-full items-center justify-between px-4 sm:flex md:px-6">
      {/* Left side: Logo + About/Help */}
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          calview
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            to="/about"
            className={`px-3 py-1.5 text-sm font-medium transition ${
              pathname === '/about' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            About
          </Link>
          <Link
            to="/help"
            className={`px-3 py-1.5 text-sm font-medium transition ${
              pathname === '/help' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Help
          </Link>
        </nav>
      </div>

      {/* Right side: Map/Calendar toggle */}
      {activeSession && (
        <nav className="flex items-center gap-1">
          <Link
            to={`/view/${activeSession}`}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              isOnMapView ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FiMap className="h-4 w-4" />
            <span>Map</span>
          </Link>
          <Link
            to={`/view/${activeSession}/calendar`}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              isOnCalendarView
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FiCalendar className="h-4 w-4" />
            <span>Calendar</span>
          </Link>
        </nav>
      )}
    </div>
  );
};

/**
 * Mobile Navbar (Visible on < sm)
 * Features: Compact height, smaller text, icon-only toggles
 */
const MobileNavbar = ({ activeSession, isOnMapView, isOnCalendarView, pathname }) => {
  return (
    <div className="flex h-12 w-full items-center justify-between px-5 sm:hidden">
      {/* Left side: Logo + About/Help */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-base font-semibold text-slate-900">
          calview
        </Link>

        <nav className="flex items-center gap-0.5">
          <Link
            to="/about"
            className={`px-2 py-1 text-sm font-medium transition ${
              pathname === '/about' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            About
          </Link>
          <Link
            to="/help"
            className={`px-2 py-1 text-sm font-medium transition ${
              pathname === '/help' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Help
          </Link>
        </nav>
      </div>

      {/* Right side: Map/Calendar toggle (Icons Only) */}
      {activeSession && (
        <nav className="flex items-center gap-0.5">
          <Link
            to={`/view/${activeSession}`}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition ${
              isOnMapView ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-label="Map View"
          >
            <FiMap className="h-3.5 w-3.5" />
          </Link>
          <Link
            to={`/view/${activeSession}/calendar`}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition ${
              isOnCalendarView
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-label="Calendar View"
          >
            <FiCalendar className="h-3.5 w-3.5" />
          </Link>
        </nav>
      )}
    </div>
  );
};

/**
 * Main Navbar Component
 */
export default function Navbar() {
  const location = useLocation();
  const savedSession = getSession();

  // Extract short_id from pathname
  const viewMatch = location.pathname.match(/^\/view\/([^/]+)/);
  const currentShortId = viewMatch ? viewMatch[1] : null;

  // Use current page's short_id if on a view page, otherwise use saved session
  const activeSession = currentShortId || savedSession;

  // Determine current view type
  const isOnMapView = currentShortId && !location.pathname.endsWith('/calendar');
  const isOnCalendarView = currentShortId && location.pathname.endsWith('/calendar');

  const commonProps = {
    activeSession,
    isOnMapView,
    isOnCalendarView,
    pathname: location.pathname,
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl">
        
        {/* 1. Desktop View */}
        <DesktopNavbar {...commonProps} />

        {/* 2. Mobile View */}
        <MobileNavbar {...commonProps} />
        
      </div>
    </header>
  );
}
