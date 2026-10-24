import React, { useEffect, useState, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  ExternalLink,
  ChevronDown,
  Info,
  RotateCcw,
  Send,
} from 'lucide-react';

// Three synthetic sample inputs for testing and demo purposes
const SYNTHETIC_SAMPLES = [
  {
    id: 'suspicious-bank',
    label: 'Sample input (synthetic): Suspicious bank credential request',
    message:
      'URGENT: Your First National Bank account has been suspended due to suspicious activity. Verify your identity immediately at https://first-national-security-portal.xyz/login to avoid permanent closure.',
    message_type: 'sms',
    url: 'https://first-national-security-portal.xyz/login',
  },
  {
    id: 'benign-grocery',
    label: 'Sample input (synthetic): Benign routine notification',
    message:
      'Hi Alex, your weekly order summary from FreshMart is ready. Your delivery of groceries is scheduled for tomorrow between 2 PM and 4 PM. View your items in the FreshMart app if you need to make changes before 8 PM tonight.',
    message_type: 'email',
    url: '',
  },
  {
    id: 'ambiguous-doc',
    label: 'Sample input (synthetic): Ambiguous message',
    message:
      'Hey, check out this document from the meeting earlier today. Let me know what you think when you get a chance.',
    message_type: 'other',
    url: 'https://docs.shared-drive-portal.net/doc/98231',
  },
];

export default function App() {
  // Backend connectivity state
  const [backendHealth, setBackendHealth] = useState('checking'); // 'checking' | 'connected' | 'offline'

  // Form input state
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('email');
  const [url, setUrl] = useState('');

  // Analysis workflow state
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [meta, setMeta] = useState(null);
  const [errorState, setErrorState] = useState(null); // { code, message }

  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);

  // Poll backend health status
  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setBackendHealth('connected');
          return;
        }
      }
      setBackendHealth('offline');
    } catch {
      setBackendHealth('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Timer effect while loading
  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  // Handle loading a synthetic sample input
  const handleSelectSample = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const sample = SYNTHETIC_SAMPLES.find((s) => s.id === selectedId);
    if (sample) {
      setMessage(sample.message);
      setMessageType(sample.message_type);
      setUrl(sample.url);
      setErrorState(null);
    }
    e.target.value = '';
  };

  // Submit analysis request
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    setErrorState(null);
    setAnalysisResult(null);
    setMeta(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          message_type: messageType,
          url: url.trim() || undefined,
        }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        let friendlyMessage = data.error || 'Analysis request failed.';
        if (data.code === 'RATE_LIMITED') {
          friendlyMessage = 'Rate limit exceeded. Please wait a few moments before trying again.';
        } else if (data.code === 'TIMEOUT') {
          friendlyMessage = 'The request timed out. The security analysis service is taking longer than expected.';
        } else if (data.code === 'MODEL_UNAVAILABLE') {
          friendlyMessage = 'The Gemma 4 model is temporarily unavailable. Please try again shortly.';
        } else if (data.code === 'MODEL_OUTPUT_INVALID') {
          friendlyMessage = 'The model output could not be validated against the defensive security schema.';
        } else if (data.code === 'AUTH_FAILED') {
          friendlyMessage = 'Authentication failed. Please verify the backend GEMINI_API_KEY.';
        }

        setErrorState({
          code: data.code || 'REQUEST_FAILED',
          message: friendlyMessage,
        });
        setIsLoading(false);
        return;
      }

      setAnalysisResult(data.analysis);
      setMeta(data.meta);
    } catch (err) {
      if (err.name === 'AbortError') {
        setErrorState({
          code: 'CANCELLED',
          message: 'Analysis was cancelled by the user.',
        });
      } else {
        setErrorState({
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the backend server. Verify your connection.',
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Cancel in-flight request
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Reset form and view
  const handleReset = () => {
    setMessage('');
    setUrl('');
    setMessageType('email');
    setAnalysisResult(null);
    setMeta(null);
    setErrorState(null);
  };

  // Helpers for styling risk level
  const getRiskBadge = (level) => {
    switch (level) {
      case 'high_concern':
        return {
          label: 'High Concern',
          bg: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
          indicatorBg: 'bg-rose-500',
          icon: AlertOctagon,
        };
      case 'suspicious':
        return {
          label: 'Suspicious',
          bg: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
          indicatorBg: 'bg-amber-500',
          icon: AlertTriangle,
        };
      case 'low_concern':
        return {
          label: 'Low Concern',
          bg: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
          indicatorBg: 'bg-emerald-500',
          icon: CheckCircle2,
        };
      case 'inconclusive':
      default:
        return {
          label: 'Inconclusive',
          bg: 'bg-slate-800/80 border-slate-600/40 text-slate-300',
          indicatorBg: 'bg-slate-400',
          icon: HelpCircle,
        };
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'high':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/50';
      case 'medium':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/50';
      case 'low':
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-[#fdfbf7] flex flex-col justify-between p-4 sm:p-8 selection:bg-emerald-500/20">
      {/* 1. Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fdfbf7]">
              LinkSleuth
            </h1>
            <p className="text-xs text-slate-400">
              Defensive Security &amp; Phishing Investigation Workspace
            </p>
          </div>
        </div>

        {/* Backend Connectivity Status Chip */}
        <div className="flex items-center">
          {backendHealth === 'checking' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700"
              role="status"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" aria-hidden="true" />
              <span>Checking backend...</span>
            </div>
          )}

          {backendHealth === 'connected' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-500/30"
              role="status"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Connected</span>
            </div>
          )}

          {backendHealth === 'offline' && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-950/70 text-rose-300 border border-rose-500/30"
              role="status"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span>Backend Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Content Grid */}
      <main className="max-w-5xl mx-auto w-full my-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Investigation Input Workspace (5 cols on lg) */}
        <section
          className="lg:col-span-5 bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-sm"
          aria-labelledby="input-heading"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="input-heading" className="text-base font-semibold text-[#fdfbf7]">
              Message Submission
            </h2>
            {/* Load Sample Dropdown */}
            <div className="relative">
              <label htmlFor="sample-selector" className="sr-only">
                Load synthetic sample input
              </label>
              <select
                id="sample-selector"
                onChange={handleSelectSample}
                defaultValue=""
                className="text-xs bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              >
                <option value="" disabled>
                  Load sample input (synthetic)...
                </option>
                {SYNTHETIC_SAMPLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Message Type Selector */}
            <fieldset>
              <legend className="text-xs font-medium text-slate-300 mb-1.5">
                Message Medium:
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'type-email', val: 'email', label: 'Email' },
                  { id: 'type-sms', val: 'sms', label: 'SMS / Text' },
                  { id: 'type-other', val: 'other', label: 'Other' },
                ].map((item) => (
                  <label
                    key={item.val}
                    htmlFor={item.id}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      messageType === item.val
                        ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      id={item.id}
                      name="message_type"
                      value={item.val}
                      checked={messageType === item.val}
                      onChange={(e) => setMessageType(e.target.value)}
                      className="sr-only"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Message Textarea with Live Counter */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="message-input" className="text-xs font-medium text-slate-300">
                  Message Content: <span className="text-rose-400" aria-hidden="true">*</span>
                </label>
                <span
                  id="char-count"
                  className={`text-[11px] font-mono ${
                    message.length > 14000 ? 'text-amber-400 font-bold' : 'text-slate-400'
                  }`}
                  aria-live="polite"
                >
                  {message.length.toLocaleString()} / 15,000
                </span>
              </div>
              <textarea
                id="message-input"
                name="message"
                rows={7}
                maxLength={15000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste the suspicious email, text message, or notification body here..."
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl p-3 text-sm text-[#fdfbf7] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 resize-y"
                aria-describedby="message-hint char-count"
              />
              <span id="message-hint" className="sr-only">
                Enter up to 15000 characters of untrusted message text to analyze.
              </span>
            </div>

            {/* Optional URL Input */}
            <div>
              <label htmlFor="url-input" className="block text-xs font-medium text-slate-300 mb-1">
                Embedded URL (Optional):
              </label>
              <input
                type="text"
                id="url-input"
                name="url"
                maxLength={2048}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example-link.com/login"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-3 py-2 text-sm text-[#fdfbf7] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-describedby="url-hint"
              />
              <p id="url-hint" className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-500 flex-shrink-0" aria-hidden="true" />
                <span>URLs are stored only as reference text and are never opened or visited.</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-2">
              <button
                type="submit"
                disabled={isLoading || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-xl shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Analyzing with Gemma 4... ({elapsedSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>Analyze Content</span>
                  </>
                )}
              </button>

              {isLoading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
                >
                  Cancel
                </button>
              ) : (
                (message || analysisResult || errorState) && (
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Reset workspace"
                    className="p-2.5 rounded-xl border border-white/10 bg-slate-900 text-slate-400 hover:text-white hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Reset workspace</span>
                  </button>
                )
              )}
            </div>
          </form>
        </section>

        {/* Right Column: Analysis Results Display (7 cols on lg) */}
        <section
          className="lg:col-span-7 bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-sm min-h-[420px] flex flex-col justify-between"
          aria-labelledby="results-heading"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <h2 id="results-heading" className="text-base font-semibold text-[#fdfbf7]">
              Security Analysis Report
            </h2>
            {meta?.model && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Model: {meta.model}
              </span>
            )}
          </div>

          {/* State 1: Loading State */}
          {isLoading && (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-3" aria-hidden="true" />
              <p className="text-base font-medium text-[#fdfbf7]">
                Performing Defensive Security Analysis
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Gemma 4 is inspecting structure, intent, and heuristic indicators... Elapsed: {elapsedSeconds}s
              </p>
            </div>
          )}

          {/* State 2: Error State */}
          {!isLoading && errorState && (
            <div
              className="my-auto p-5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-300">
                    Analysis Error: {errorState.code}
                  </h3>
                  <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                    {errorState.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* State 3: Empty State */}
          {!isLoading && !errorState && !analysisResult && (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center text-slate-400">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 mb-3">
                <ShieldAlert className="w-8 h-8 text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-200">
                Awaiting Submission
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Paste an untrusted message or load a synthetic sample on the left to evaluate for social engineering, urgency lures, and phishing markers.
              </p>
            </div>
          )}

          {/* State 4: Results Display */}
          {!isLoading && !errorState && analysisResult && (
            <div className="flex flex-col gap-5">
              {/* Risk Banner & Heuristic Score */}
              {(() => {
                const badge = getRiskBadge(analysisResult.risk_level);
                const Icon = badge.icon;
                return (
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${badge.bg}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-black/20">
                        <Icon className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wider font-semibold opacity-75">
                          Assessed Threat Level
                        </div>
                        <div className="text-lg font-bold">{badge.label}</div>
                      </div>
                    </div>

                    {/* Heuristic Score Indicator */}
                    <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
                      <div className="text-xs text-slate-300 font-medium">
                        Heuristic Score: <span className="font-bold text-base text-[#fdfbf7]">{analysisResult.heuristic_score}</span> / 100
                      </div>
                      <div className="text-[10px] text-slate-400 italic">
                        Heuristic indicator, NOT a probability
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Inconclusive Warning if applicable */}
              {analysisResult.risk_level === 'inconclusive' && (
                <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Inconclusive evaluation:</strong> Evidence in the submitted text is insufficient or sparse. Always verify independently through trusted out-of-band channels.
                  </span>
                </div>
              )}

              {/* Summary */}
              <div>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Executive Summary
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                  {analysisResult.summary}
                </p>
              </div>

              {/* Indicators List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Identified Indicators ({analysisResult.indicators?.length || 0})
                  </h3>
                  {meta?.unverified_evidence_count > 0 && (
                    <span className="text-[11px] text-amber-400 font-medium bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                      ⚠️ {meta.unverified_evidence_count} unverified quote(s)
                    </span>
                  )}
                </div>

                {(!analysisResult.indicators || analysisResult.indicators.length === 0) ? (
                  <p className="text-xs text-slate-400 italic bg-black/20 p-2.5 rounded-lg border border-white/5">
                    No deceptive or malicious indicators detected in submission text.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {analysisResult.indicators.map((ind, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-black/30 border border-white/10 flex flex-col gap-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                              {ind.category.replace('_', ' ')}
                            </span>
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${getSeverityBadge(
                                ind.severity
                              )}`}
                            >
                              {ind.severity}
                            </span>
                          </div>

                          {ind.unverified && (
                            <span className="text-[10px] text-amber-300 bg-amber-950/70 border border-amber-600/50 px-2 py-0.5 rounded">
                              ⚠️ Quote unverified in submission
                            </span>
                          )}
                        </div>

                        {/* Evidence Quote */}
                        <div className="text-xs font-mono text-emerald-300 bg-black/40 px-2.5 py-1.5 rounded border border-white/5">
                          "{ind.evidence}"
                        </div>

                        {/* Explanation & Uncertainty */}
                        <p className="text-xs text-slate-300 leading-normal">
                          {ind.explanation}
                        </p>
                        {ind.uncertainty && (
                          <p className="text-[11px] text-slate-400 italic">
                            Uncertainty: {ind.uncertainty}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signals, Recommendations, Limitations Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Positive / Neutral Signals */}
                <div className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col gap-1.5">
                  <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Positive or Neutral Signals</span>
                  </h4>
                  {(!analysisResult.positive_or_neutral_signals || analysisResult.positive_or_neutral_signals.length === 0) ? (
                    <p className="text-slate-400 italic">None noted.</p>
                  ) : (
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {analysisResult.positive_or_neutral_signals.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Recommended Actions */}
                <div className="p-3 rounded-lg bg-black/20 border border-white/5 flex flex-col gap-1.5">
                  <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Recommended Actions</span>
                  </h4>
                  {(!analysisResult.recommended_actions || analysisResult.recommended_actions.length === 0) ? (
                    <p className="text-slate-400 italic">None provided.</p>
                  ) : (
                    <ul className="list-disc list-inside text-slate-300 space-y-1">
                      {analysisResult.recommended_actions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Limitations */}
              {analysisResult.limitations?.length > 0 && (
                <div className="p-2.5 rounded-lg bg-black/15 border border-white/5 text-[11px] text-slate-400 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-semibold text-slate-300">Analysis Limitations:</span>{' '}
                    {analysisResult.limitations.join('; ')}
                  </div>
                </div>
              )}

              {/* Meta footer */}
              {meta && (
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                  <span>Latency: {meta.latency_ms}ms</span>
                  <span>Model: {meta.model}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer note when empty */}
          {!analysisResult && !isLoading && !errorState && (
            <div className="pt-3 border-t border-white/5 text-center text-xs text-slate-400">
              Analysis strictly powered by Google Gemma 4. Zero fabricated results.
            </div>
          )}
        </section>
      </main>

      {/* 3. Footer */}
      <footer className="max-w-5xl mx-auto w-full border-t border-white/5 pt-4 text-center text-xs text-slate-400">
        LinkSleuth &bull; Defensive Security Workspace &bull; MIT License
      </footer>
    </div>
  );
}
