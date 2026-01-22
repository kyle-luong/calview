import FileUpload from '../components/FileUpload';
import MapBox from '../components/map/MapBox';

/**
 * Shared Content Component
 * Extracts the text and upload button so we don't duplicate code
 */
const HeroSection = () => (
  <div className="flex w-full flex-col items-center justify-center">
    <div className="w-full max-w-xl space-y-10 text-center md:text-left">
      <h1 className="text-5xl leading-tight font-bold text-slate-900">
        Map your schedule.
        <br />
        Share your day.
      </h1>
      <p className="max-w-prose text-lg text-slate-600">
        Upload your calendar and get a smarter, visual view of your day. calview creates a
        shareable, location-aware schedule, complete with travel times and map-based context.
      </p>
      <div className="w-full">
        <FileUpload />
      </div>
    </div>
  </div>
);

/**
 * Desktop Layout (Visible on md+)
 * Two-column Grid: Left = Text/Upload, Right = Map
 */
const DesktopHome = () => {
  return (
    <div className="hidden h-[82vh] w-full max-w-6xl grid-cols-2 gap-12 rounded-xl border border-slate-200 bg-white p-10 shadow-md md:grid">
      {/* Left Side */}
      <HeroSection />

      {/* Right Side: Map Preview */}
      <div className="flex items-center justify-center">
        <div className="flex h-[440px] w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-500">
          <MapBox />
        </div>
      </div>
    </div>
  );
};

/**
 * Mobile Layout (Visible on < md)
 * Single Column: Text/Upload only (Map is hidden on mobile in original design)
 */
const MobileHome = () => {
  return (
    <div className="flex w-full max-w-xl flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-md md:hidden">
      <HeroSection />
    </div>
  );
};

/**
 * Main Page Component
 */
export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4 md:px-8">
      
      {/* 1. Desktop View */}
      <DesktopHome />

      {/* 2. Mobile View */}
      <MobileHome />
      
    </div>
  );
}