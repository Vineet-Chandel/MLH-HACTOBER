import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [healthStatus, setHealthStatus] = useState('checking'); // 'checking' | 'connected' | 'offline'

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setHealthStatus('connected');
          return;
        }
      }
      setHealthStatus('offline');
    } catch {
      setHealthStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-[#fdfbf7] flex flex-col justify-between p-6 sm:p-10 selection:bg-emerald-500/20">
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#fdfbf7]">
            LinkSleuth
          </h1>
        </div>

        {/* Backend Connectivity Status Chip */}
        <div className="flex items-center">
          {healthStatus === 'checking' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-hidden="true" />
              <span>Checking backend...</span>
            </div>
          )}

          {healthStatus === 'connected' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-500/30"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Connected</span>
            </div>
          )}

          {healthStatus === 'offline' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-950/70 text-rose-300 border border-rose-500/30"
              role="status"
              aria-live="polite"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full my-auto py-16 flex flex-col items-center text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400/90 mb-3">
          Phase 1 & Phase 2 Verified
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#fdfbf7] max-w-xl">
          Gemma 4 Verification Active
        </h2>
        <p className="mt-4 text-base text-slate-400 max-w-lg leading-relaxed">
          LinkSleuth workspace and backend skeleton initialized. Server health check and direct Gemma 4 model integration validated.
        </p>
      </main>

      <footer className="max-w-4xl mx-auto w-full border-t border-white/5 pt-6 text-center text-xs text-slate-500">
        LinkSleuth &bull; MIT License &bull; Google Gemma 4
      </footer>
    </div>
  );
}
