import { useState } from 'react';
import { FiLink, FiCopy, FiCheck } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';

export default function ShareableLinkMobile({ shortId }) {
  const [copied, setCopied] = useState(false);
  const location = useLocation();

  const isCalendarPage = location.pathname.endsWith('/calendar');
  const suffix = isCalendarPage ? '/calendar' : '';

  const shareUrl = `${window.location.origin}/view/${shortId}${suffix}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 active:scale-[0.98]"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">
          Share
        </span>
      </div>

      {copied ? (
        <FiCheck className="h-4 w-4 text-emerald-600 ml-3" />
      ) : (
        <FiCopy className="h-4 w-4 text-sky-600 ml-3" />
      )}
    </button>
  );
}
