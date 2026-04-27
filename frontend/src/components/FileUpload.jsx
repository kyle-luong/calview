import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiFetch } from '../lib/api';
import { logger } from '../lib/logger';
import { saveSession } from '../lib/session';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

async function waitForCompletion(shortId, onTick) {
  const started = Date.now();
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const data = await apiFetch(`/api/sessions/${shortId}/status`);
    onTick?.(data);
    if (data.status === 'COMPLETE') return data;
    if (data.status === 'FAILED') throw new Error(data.error_message || 'Processing failed');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Processing timed out');
}

export default function FileUpload() {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [shortId, setShortId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [stage, setStage] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setFilename(file.name);
    setError('');
    setStage('Creating session...');

    try {
      // 1. Create session, get presigned URL
      const session = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!session.short_id || !session.upload_url) throw new Error('Failed to create session');

      // 2. Upload .ics directly to S3
      setStage('Uploading calendar...');
      const putRes = await fetch(session.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/calendar' },
        body: file,
      });
      if (!putRes.ok) throw new Error('Upload to storage failed');

      // 3. Trigger Step Functions import workflow
      setStage('Processing...');
      await apiFetch(`/api/sessions/${session.short_id}/process`, { method: 'POST' });

      // 4. Poll until COMPLETE/FAILED
      await waitForCompletion(session.short_id, (s) => {
        setStage(`Processing... (${s.status?.toLowerCase() || 'pending'})`);
      });

      setShortId(session.short_id);
      saveSession(session.short_id);
      setStage('Done');
    } catch (err) {
      logger.error('Upload failed:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center">
      <input ref={inputRef} type="file" accept=".ics" onChange={handleUpload} className="hidden" />

      <div className="w-full space-y-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-full rounded-md bg-sky-600 px-6 py-3 text-base font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? stage || 'Uploading...' : 'Upload a calendar file'}
        </button>

        <button
          onClick={() => navigate(`/view/${shortId}`)}
          disabled={!shortId || isUploading}
          className="w-full rounded-md bg-slate-900 px-6 py-3 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          See your map
        </button>

        <div className="mt-2 min-h-[1.5rem] text-center text-sm">
          {filename && !error && <span className="text-slate-500">Selected: {filename}</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
